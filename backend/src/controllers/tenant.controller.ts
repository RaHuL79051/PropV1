import { Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { serialize } from '../utils/serialize.js';
import { updateTenantStatsByAadhaar } from '../utils/scoreHelper.js';
import { sendMail } from '../utils/mailer.js';
import { buildTenantInviteEmail } from '../templates/inviteEmail.js';
import { buildRentBillEmail } from '../templates/rentBillEmail.js';

// Throws unless the caller is an admin or currently linked to this tenant.
export const assertTenantAccess = async (
  req: AuthenticatedRequest,
  tenantId: string,
  action = 'access this tenant'
) => {
  if (req.user?.role === 'admin') return;
  const connection = await prisma.tenantOwnerConnection.findFirst({
    where: { tenantId, ownerId: req.user?.userId, isDeleted: false }
  });
  if (!connection) {
    throw new AppError(`Unauthorized attempt to ${action}`, 403);
  }
};

// Helper to get active tenant IDs for an owner
export const getOwnerTenantIds = async (ownerId: string): Promise<string[]> => {
  const connections = await prisma.tenantOwnerConnection.findMany({
    where: { ownerId, isDeleted: false },
    select: { tenantId: true }
  });
  return connections.map((c) => c.tenantId);
};

// Helper to check if owner has unpaid persons
export const checkUnpaidPersonsLimit = async (ownerId: string) => {
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  const totalTenants = await prisma.tenantOwnerConnection.count({ where: { ownerId, isDeleted: false } });
  const paidPersons = owner.paidBeds || 0;
  const unpaidPersons = Math.max(0, totalTenants - 2 - paidPersons);

  if (unpaidPersons > 0) {
    const amountDue = unpaidPersons * 20;
    throw new AppError(
      `Payment required: ${unpaidPersons} tenant${unpaidPersons > 1 ? 's are' : ' is'} beyond your free limit of 2. ` +
        `Please pay ₹${amountDue} to unlock the portal.`,
      402
    );
  }
};

const getFrontendUrl = (req?: Request) => {
  const requestOrigin = req?.headers.origin?.toString().replace(/\/+$/, '');
  return requestOrigin || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
};

const hashInviteToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Resolves the rent a single tenant owes: an explicit per-tenant override wins,
// otherwise a flat's rent is split across its occupants and a PG bed pays the room rate.
export const resolveTenantRent = (tenant: any, room: any): number => {
  if (tenant?.rentAmount !== null && tenant?.rentAmount !== undefined) {
    return Number(tenant.rentAmount);
  }
  if (!room) return 0;
  return room.roomType === 'flat'
    ? Math.round(room.monthlyRent / (room.bedCapacity || 1))
    : room.monthlyRent;
};

/**
 * Bills a tenant who moves in part-way through a month for the days they will
 * actually occupy the bed. A tenant joining on the 16th of a 30-day month is
 * charged for the 16th-30th inclusive, i.e. 15 of the 30 days. From the 1st of
 * the following month the normal full-month cycle takes over.
 */
export const createProratedInvoice = async (
  tenantId: string,
  propertyId: string,
  roomId: string,
  monthlyRent: number,
  joiningDateInput: Date | string | null | undefined
) => {
  if (!joiningDateInput || !monthlyRent || monthlyRent <= 0) return null;
  const joiningDate = new Date(joiningDateInput);
  if (isNaN(joiningDate.getTime())) return null;

  const year = joiningDate.getFullYear();
  const month = joiningDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const joinDay = joiningDate.getDate();
  // Inclusive of the joining day itself.
  const remainingDays = daysInMonth - joinDay + 1;

  const proratedAmount = Math.round((monthlyRent / daysInMonth) * remainingDays);
  if (proratedAmount <= 0) return null;

  // Never raise a second joining invoice for the same move-in.
  const periodStart = new Date(year, month, 1);
  const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const existing = await prisma.payment.findFirst({
    where: {
      tenantId,
      dueDate: { gte: periodStart, lte: periodEnd },
      notes: { startsWith: 'Pro-rated joining rent' }
    }
  });
  if (existing) return existing;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const notes =
    `Pro-rated joining rent for ${joinDay}-${daysInMonth} ${monthNames[month]} ${year}.\n` +
    `Monthly rent: ₹${monthlyRent} over ${daysInMonth} days.\n` +
    `Charged for ${remainingDays} day(s): ₹${proratedAmount}.`;

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      propertyId,
      roomId,
      amount: proratedAmount,
      // Due at the end of the joining month; the regular cycle resets on the 1st.
      dueDate: periodEnd,
      status: 'unpaid',
      paymentMethod: 'none',
      transactionId: null,
      notes
    }
  });

  return payment;
};

/**
 * Verifies that a property/room/bed trio exists, hangs together, and belongs to
 * the given owner before anything is allocated to it.
 */
export const resolveAllocation = async (
  ownerId: string,
  propertyId?: string | null,
  roomId?: string | null,
  bedId?: string | null,
  tenantId?: string | null
) => {
  if (!roomId) return null;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError('Selected room could not be found', 404);

  const property = await prisma.property.findUnique({ where: { id: propertyId || room.propertyId } });
  if (!property) throw new AppError('Selected property could not be found', 404);

  if (room.propertyId !== property.id) {
    throw new AppError('Selected room does not belong to the selected property', 400);
  }
  if (property.ownerId !== ownerId) {
    throw new AppError('You can only allocate space in your own properties', 403);
  }

  let bed = null;
  if (bedId) {
    bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) throw new AppError('Selected bed could not be found', 404);
    if (bed.roomId !== room.id) {
      throw new AppError('Selected bed does not belong to the selected room', 400);
    }
    if (bed.isOccupied && (!tenantId || bed.tenantId !== tenantId)) {
      throw new AppError('That bed is already occupied. Please choose a vacant one.', 409);
    }
  }

  if (room.roomType === 'flat') {
    const occupants = await prisma.tenant.count({
      where: {
        assignedRoomId: room.id,
        ...(tenantId ? { id: { not: tenantId } } : {})
      }
    });
    if (occupants >= room.bedCapacity) {
      throw new AppError('This flat is already at its maximum number of occupants.', 409);
    }
  }

  return { property, room, bed };
};

export const createTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      fullName,
      aadhaarNumber,
      panNumber,
      email,
      phone,
      emergencyContact,
      occupation,
      address,
      assignedProperty,
      assignedRoom,
      assignedBed,
      rentAmount,
      joiningDate,
      ownerId: bodyOwnerId
    } = req.body;
    const ownerId = req.user?.role === 'admin' && bodyOwnerId ? bodyOwnerId : req.user?.userId;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    // Check if tenant exists globally
    let tenant = await prisma.tenant.findFirst({ where: { aadhaarNumber } });
    let connection = tenant
      ? await prisma.tenantOwnerConnection.findFirst({ where: { tenantId: tenant.id, ownerId } })
      : null;

    if (connection && !connection.isDeleted) {
      throw new AppError('A tenant with this Aadhaar number is already active in your registry.', 409);
    }

    // Linking another person to this owner consumes a licence slot.
    if (req.user?.role !== 'admin') {
      await checkUnpaidPersonsLimit(ownerId);
    }

    // Validate any requested allocation up-front so a failure does not leave a
    // half-created tenant behind.
    const allocation = assignedRoom
      ? await resolveAllocation(ownerId, assignedProperty, assignedRoom, assignedBed, tenant?.id)
      : null;

    if (allocation && tenant && tenant.assignedRoomId && tenant.assignedRoomId !== assignedRoom) {
      throw new AppError('This tenant is already occupying a room under another owner and cannot be allocated here', 400);
    }

    const latestLog = await prisma.verificationLog.findFirst({
      where: { aadhaarNumber, requesterId: ownerId },
      orderBy: { createdAt: 'desc' }
    });

    const verificationStatus = latestLog ? latestLog.status : 'verified';
    const riskLevel = latestLog ? latestLog.riskLevel : 'low';
    const tenantRating = latestLog ? ((latestLog.result as any)?.previousRating ?? 5.0) : 5.0;
    const creditScore = latestLog ? ((latestLog.result as any)?.creditScore ?? 700) : 700;
    const previousOwnerFeedback = latestLog
      ? ((latestLog.result as any)?.feedback ?? [])
      : ['No previous owner reviews registered.'];

    // Apply the allocation, if one was supplied with the registration.
    let effectiveJoiningDate: Date | null = null;
    const allocationFields: any = {};
    if (allocation) {
      allocationFields.assignedPropertyId = allocation.property.id;
      allocationFields.assignedRoomId = allocation.room.id;
      allocationFields.assignedBedId = allocation.bed?.id ?? null;
      allocationFields.agreementStatus = allocation.bed ? 'active' : 'pending';

      if (rentAmount !== undefined && rentAmount !== null && rentAmount !== '') {
        allocationFields.rentAmount = Number(rentAmount);
      }

      const parsedJoining = joiningDate ? new Date(joiningDate) : new Date();
      effectiveJoiningDate = isNaN(parsedJoining.getTime()) ? new Date() : parsedJoining;
      allocationFields.joiningDate = effectiveJoiningDate;
    }

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          fullName,
          aadhaarNumber,
          panNumber: panNumber || '',
          email: email || '',
          phone,
          emergencyContact,
          occupation,
          address,
          ownerId,
          agreementStatus: 'pending',
          verificationStatus,
          riskLevel,
          tenantRating,
          creditScore,
          previousOwnerFeedback,
          rentAmount: null,
          joiningDate: null,
          ...allocationFields
        }
      });
    } else {
      // Update tenant details if they already exist globally
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          fullName: fullName || tenant.fullName,
          panNumber: panNumber || tenant.panNumber || '',
          email: email || tenant.email,
          phone: phone || tenant.phone,
          emergencyContact: emergencyContact || tenant.emergencyContact,
          occupation: occupation || tenant.occupation,
          address: address || tenant.address,
          ...allocationFields
        }
      });
    }

    if (allocation) {
      // Occupy the bed only once the tenant row is safely persisted.
      if (allocation.bed) {
        await prisma.bed.update({ where: { id: allocation.bed.id }, data: { isOccupied: true, tenantId: tenant.id } });
      }
      await updateRoomOccupancy(allocation.room.id);

      // Charge only for the days actually occupied in the joining month.
      try {
        await createProratedInvoice(
          tenant.id,
          allocation.property.id,
          allocation.room.id,
          resolveTenantRent(tenant, allocation.room),
          effectiveJoiningDate
        );
      } catch (err) {
        console.error('Error creating pro-rated joining invoice:', err);
      }
    }

    // Create or activate connection
    if (!connection) {
      connection = await prisma.tenantOwnerConnection.create({
        data: { tenantId: tenant.id, ownerId, isDeleted: false }
      });
    } else {
      connection = await prisma.tenantOwnerConnection.update({
        where: { id: connection.id },
        data: { isDeleted: false }
      });
    }

    try {
      await updateTenantStatsByAadhaar(tenant.aadhaarNumber);
    } catch (err) {
      console.error('Error updating tenant stats on creation:', err);
    }

    return res.status(201).json({
      message: 'Tenant created successfully',
      tenant: serialize(tenant)
    });
  } catch (error) {
    next(error);
  }
};

export const getTenants = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    let where: any = {};
    if (req.user?.role !== 'admin') {
      const tenantIds = await getOwnerTenantIds(ownerId!);
      where = { id: { in: tenantIds } };
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        assignedProperty: { select: { id: true, propertyName: true, address: true } },
        assignedRoom: { select: { id: true, roomNumber: true, monthlyRent: true } },
        assignedBed: { select: { id: true, bedNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(serialize(tenants));
  } catch (error) {
    next(error);
  }
};

export const activateConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const { aadhaarNumber } = req.body;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    const tenant = await prisma.tenant.findFirst({ where: { aadhaarNumber } });
    if (!tenant) {
      throw new AppError('No tenant record exists for this Aadhaar number.', 404);
    }

    let connection = await prisma.tenantOwnerConnection.findFirst({ where: { tenantId: tenant.id, ownerId } });
    if (!connection) {
      connection = await prisma.tenantOwnerConnection.create({
        data: { tenantId: tenant.id, ownerId, isDeleted: false }
      });
    } else {
      connection = await prisma.tenantOwnerConnection.update({
        where: { id: connection.id },
        data: { isDeleted: false }
      });
    }

    return res.status(200).json({
      message: 'Connection activated successfully',
      tenant: serialize(tenant)
    });
  } catch (error) {
    next(error);
  }
};

export const getTenantById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        assignedProperty: { select: { id: true, propertyName: true, address: true } },
        assignedRoom: { select: { id: true, roomNumber: true, monthlyRent: true } },
        assignedBed: { select: { id: true, bedNumber: true } }
      }
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: id, ownerId: req.user?.userId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You do not have access to this tenant.', 403);
      }
    }

    return res.status(200).json(serialize(tenant));
  } catch (error) {
    next(error);
  }
};

export const updateTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      panNumber,
      phone,
      emergencyContact,
      occupation,
      address,
      assignedProperty,
      assignedRoom,
      assignedBed,
      rentAmount,
      joiningDate,
      verificationStatus
    } = req.body;
    const ownerId = req.user?.userId;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: id, ownerId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only update tenants linked to your account.', 403);
      }
    }

    // Check unpaid persons limit if assigning a new room or bed
    if (req.user?.role !== 'admin' && ownerId && (
      (assignedBed !== undefined && assignedBed !== (tenant.assignedBedId || null)) ||
      (assignedRoom !== undefined && assignedRoom !== (tenant.assignedRoomId || null))
    )) {
      await checkUnpaidPersonsLimit(ownerId);
    }

    const data: any = {
      fullName: fullName || tenant.fullName,
      panNumber: panNumber !== undefined ? panNumber : tenant.panNumber,
      email: req.body.email || tenant.email,
      phone: phone || tenant.phone,
      emergencyContact: emergencyContact || tenant.emergencyContact,
      occupation: occupation || tenant.occupation,
      address: address || tenant.address
    };
    if (rentAmount !== undefined) {
      data.rentAmount = rentAmount || null;
    }
    if (verificationStatus !== undefined) {
      data.verificationStatus = verificationStatus;
    }

    // Handle Property/Room/Bed reassignments
    const oldBedId = tenant.assignedBedId;
    const oldRoomId = tenant.assignedRoomId;
    // A tenant with no room and no bed is moving in rather than moving around.
    const wasUnallocated = !oldRoomId && !oldBedId;

    let allocationChanged = false;

    // Validate the destination before mutating anything.
    const targetRoomId = assignedRoom !== undefined ? assignedRoom : oldRoomId || null;
    const targetBedId = assignedBed !== undefined ? assignedBed : oldBedId || null;
    const roomOrBedChanged =
      (assignedRoom !== undefined && assignedRoom !== (oldRoomId || null)) ||
      (assignedBed !== undefined && assignedBed !== (oldBedId || null));

    let allocation: Awaited<ReturnType<typeof resolveAllocation>> = null;
    if (roomOrBedChanged && targetRoomId) {
      const propIdForOwnerLookup = assignedProperty ?? tenant.assignedPropertyId ?? undefined;
      const allocationOwnerId =
        req.user?.role === 'admin'
          ? (propIdForOwnerLookup
              ? (await prisma.property.findUnique({ where: { id: propIdForOwnerLookup } }))?.ownerId
              : undefined) || ownerId
          : ownerId;
      allocation = await resolveAllocation(
        allocationOwnerId!,
        assignedProperty ?? tenant.assignedPropertyId ?? undefined,
        targetRoomId,
        targetBedId,
        tenant.id
      );
    }

    // Track the effective assigned* ids as the function progresses, mirroring
    // the sequential mutation the previous Mongoose document went through.
    let currentRoomId = tenant.assignedRoomId;
    let currentBedId = tenant.assignedBedId;

    if (assignedProperty !== undefined && assignedProperty !== (tenant.assignedPropertyId || null)) {
      data.assignedPropertyId = assignedProperty || null;
      allocationChanged = true;
    }

    if (assignedRoom !== undefined && assignedRoom !== (oldRoomId || null)) {
      currentRoomId = assignedRoom || null;
      data.assignedRoomId = currentRoomId;
      allocationChanged = true;
    }

    if (assignedBed !== undefined && assignedBed !== (oldBedId || null)) {
      // Release old bed
      if (oldBedId) {
        await prisma.bed.update({ where: { id: oldBedId }, data: { isOccupied: false, tenantId: null } });
      }

      // Assign new bed (already validated above)
      if (assignedBed) {
        await prisma.bed.update({ where: { id: assignedBed }, data: { isOccupied: true, tenantId: tenant.id } });
        currentBedId = assignedBed;
      } else {
        currentBedId = null;
      }
      data.assignedBedId = currentBedId;
      allocationChanged = true;
    }

    // Dropping the room without naming a bed must still free the bed behind it.
    if (allocationChanged && !currentRoomId && currentBedId) {
      await prisma.bed.update({ where: { id: currentBedId }, data: { isOccupied: false, tenantId: null } });
      currentBedId = null;
      data.assignedBedId = null;
    }

    let moveInDate: Date | null = null;
    if (allocationChanged) {
      data.agreementStatus = currentBedId ? 'active' : 'pending';

      if (!currentRoomId && !currentBedId) {
        // Fully unassigned: clear the move-in date so a future allocation re-prorates.
        data.joiningDate = null;
      } else if (wasUnallocated) {
        const parsedJoining = joiningDate ? new Date(joiningDate) : new Date();
        moveInDate = isNaN(parsedJoining.getTime()) ? new Date() : parsedJoining;
        data.joiningDate = moveInDate;
      }
    }

    const updated = await prisma.tenant.update({ where: { id }, data });

    if (allocationChanged) {
      // Update room occupancy states
      if (oldRoomId) await updateRoomOccupancy(oldRoomId);
      if (currentRoomId) await updateRoomOccupancy(currentRoomId);

      // First allocation for this tenant: bill only the days they will occupy.
      if (moveInDate && allocation) {
        try {
          await createProratedInvoice(
            updated.id,
            allocation.property.id,
            allocation.room.id,
            resolveTenantRent(updated, allocation.room),
            moveInDate
          );
        } catch (err) {
          console.error('Error creating pro-rated joining invoice:', err);
        }
      }
    }
    return res.status(200).json({ message: 'Tenant updated successfully', tenant: serialize(updated) });
  } catch (error) {
    next(error);
  }
};

export const deleteTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.userId;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: id, ownerId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only remove tenants linked to your account.', 403);
      }

      const releasedRoomId = tenant.assignedRoomId || null;

      // Release bed if assigned
      if (tenant.assignedBedId) {
        await prisma.bed.update({ where: { id: tenant.assignedBedId }, data: { isOccupied: false, tenantId: null } });
      }

      // Soft delete the connection
      await prisma.tenantOwnerConnection.update({ where: { id: connection.id }, data: { isDeleted: true } });

      // Clear space assignments
      await prisma.tenant.update({
        where: { id },
        data: {
          assignedPropertyId: null,
          assignedRoomId: null,
          assignedBedId: null,
          agreementStatus: 'pending',
          rentAmount: null,
          joiningDate: null
        }
      });

      // Recompute only after the tenant no longer points at the room.
      if (releasedRoomId) {
        await updateRoomOccupancy(releasedRoomId);
      }
    } else {
      // Admin deletes tenant globally
      const releasedRoomId = tenant.assignedRoomId || null;
      if (tenant.assignedBedId) {
        await prisma.bed.update({ where: { id: tenant.assignedBedId }, data: { isOccupied: false, tenantId: null } });
      }
      await prisma.tenantOwnerConnection.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { id } });
      if (releasedRoomId) {
        await updateRoomOccupancy(releasedRoomId);
      }
    }

    return res.status(200).json({ message: 'Tenant removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const checkoutTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;
    const ownerId = req.user?.userId;

    if (rating === undefined || !feedback || !String(feedback).trim()) {
      throw new AppError('Rating and feedback are required for checking out a tenant', 400);
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new AppError('Rating must be a whole number between 1 and 5', 400);
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: id, ownerId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only check out tenants linked to your account.', 403);
      }
      await checkUnpaidPersonsLimit(ownerId!);

      // Soft delete the connection so it is removed from the owner's registry
      await prisma.tenantOwnerConnection.update({ where: { id: connection.id }, data: { isDeleted: true } });
    } else {
      // For admin, soft-delete all active connections for this tenant
      await prisma.tenantOwnerConnection.updateMany({ where: { tenantId: id, isDeleted: false }, data: { isDeleted: true } });
    }

    // Create a TenantReview linked to the Aadhaar number
    await prisma.tenantReview.create({
      data: {
        aadhaarNumber: tenant.aadhaarNumber,
        tenantName: tenant.fullName,
        rating: numericRating,
        feedback: String(feedback).trim(),
        ownerId: ownerId!
      }
    });

    const oldBedId = tenant.assignedBedId;
    const oldRoomId = tenant.assignedRoomId;

    // Release Bed if assigned
    if (oldBedId) {
      await prisma.bed.update({ where: { id: oldBedId }, data: { isOccupied: false, tenantId: null } });
    }

    // Update tenant status. Clearing rent/joiningDate stops the monthly
    // scheduler from billing a departed tenant.
    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        assignedPropertyId: null,
        assignedRoomId: null,
        assignedBedId: null,
        agreementStatus: 'expired',
        rentAmount: null,
        joiningDate: null
      }
    });
    await prisma.tenantAdditionalCharge.deleteMany({ where: { tenantId: id } });

    // Update room occupancy
    if (oldRoomId) {
      await updateRoomOccupancy(oldRoomId);
    }

    try {
      await updateTenantStatsByAadhaar(updated.aadhaarNumber);
    } catch (err) {
      console.error('Error updating tenant stats on checkout:', err);
    }

    return res.status(200).json({
      message: 'Tenant checked out successfully and review recorded',
      tenant: serialize(updated)
    });
  } catch (error) {
    next(error);
  }
};

export const uploadDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.userId;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: id, ownerId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only manage documents for tenants linked to your account.', 403);
      }
      await checkUnpaidPersonsLimit(ownerId!);
    }

    const {
      aadhaarDocName,
      aadhaarDocData,
      agreementDocName,
      agreementDocData,
      photoDocName,
      photoDocData
    } = req.body;

    // Documents are stored inline as base64, so reject anything that would push
    // the record's size out of a sane bound.
    const MAX_DOC_BYTES = 4 * 1024 * 1024; // ~3MB of original file once base64-encoded
    const incoming: Array<[string, any]> = [
      ['Aadhaar document', aadhaarDocData],
      ['Agreement document', agreementDocData],
      ['Photo', photoDocData]
    ];
    for (const [label, data] of incoming) {
      if (typeof data === 'string' && data.length > MAX_DOC_BYTES) {
        throw new AppError(`${label} is too large. Please upload a file under 3MB.`, 413);
      }
    }

    const documents: any = { ...((tenant.documents as any) || {}) };
    if (aadhaarDocName !== undefined) documents.aadhaarDocName = aadhaarDocName;
    if (aadhaarDocData !== undefined) documents.aadhaarDocData = aadhaarDocData;
    if (agreementDocName !== undefined) documents.agreementDocName = agreementDocName;
    if (agreementDocData !== undefined) documents.agreementDocData = agreementDocData;
    if (photoDocName !== undefined) documents.photoDocName = photoDocName;
    if (photoDocData !== undefined) documents.photoDocData = photoDocData;

    const updated = await prisma.tenant.update({ where: { id }, data: { documents } });

    return res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: updated.documents
    });
  } catch (error) {
    next(error);
  }
};

export const createTenantInvite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      aadhaarNumber,
      panNumber,
      email,
      sendMethod = 'email',
      whatsappNumber,
      assignedProperty,
      assignedRoom,
      assignedBed,
      joiningDate,
      ownerId: bodyOwnerId
    } = req.body;
    const ownerId = req.user?.role === 'admin' && bodyOwnerId ? bodyOwnerId : req.user?.userId;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    // Inviting someone consumes a licence slot in the same way adding them does.
    if (req.user?.role !== 'admin') {
      await checkUnpaidPersonsLimit(ownerId);
    }

    // Confirm the bed being held for this invite is really the owner's and free.
    const allocation = assignedRoom
      ? await resolveAllocation(ownerId, assignedProperty, assignedRoom, assignedBed)
      : null;

    const parsedJoining = joiningDate ? new Date(joiningDate) : null;
    const inviteJoiningDate = parsedJoining && !isNaN(parsedJoining.getTime()) ? parsedJoining : null;

    let targetEmail = email;
    const existingTenant = await prisma.tenant.findFirst({ where: { aadhaarNumber } });
    if (!targetEmail && existingTenant?.email) {
      targetEmail = existingTenant.email;
    }

    if (sendMethod === 'email' && !targetEmail) {
      throw new AppError('An email address is required to send the invitation. Enter one, or share the link over WhatsApp instead.', 400);
    }

    // Set fallback placeholder email for WhatsApp method if none exists
    if (sendMethod === 'whatsapp' && !targetEmail) {
      targetEmail = `whatsapp_${aadhaarNumber}@proptenant.local`;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashInviteToken(rawToken);
    const invite = await prisma.tenantInvite.create({
      data: {
        ownerId,
        aadhaarNumber,
        panNumber: panNumber || '',
        email: targetEmail,
        tokenHash,
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
        assignedPropertyId: allocation?.property.id ?? null,
        assignedRoomId: allocation?.room.id ?? null,
        assignedBedId: allocation?.bed?.id ?? null,
        joiningDate: inviteJoiningDate
      }
    });

    const inviteUrl = `${getFrontendUrl(req)}/invite/${rawToken}`;

    if (sendMethod === 'email') {
      const subject = 'Property Manager invitation to complete your tenant profile';
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { fullName: true } });
      const inviteEmail = buildTenantInviteEmail({
        ownerName: String(owner?.fullName || 'Property Manager'),
        tenantEmail: targetEmail,
        inviteUrl,
        propertyName: allocation?.property?.propertyName ?? null,
        roomNumber: allocation?.room?.roomNumber ?? null,
        bedNumber: allocation?.bed?.bedNumber ?? null
      });

      try {
        await sendMail({
          to: targetEmail,
          subject,
          text: inviteEmail.text,
          html: inviteEmail.html
        });
      } catch (mailError: any) {
        console.error('[Invite] Failed to send invitation email:', mailError);
        throw new AppError(
          `We could not email the invitation to ${targetEmail}. Please check the address and try again, ` +
            'or share the invitation link directly.',
          502
        );
      }
    }

    return res.status(201).json({
      message: sendMethod === 'email'
        ? 'Invitation link generated and sent successfully'
        : 'Invitation link generated successfully for WhatsApp',
      invite: {
        id: invite.id,
        aadhaarNumber: invite.aadhaarNumber,
        panNumber: invite.panNumber,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteUrl
      },
      emailSent: sendMethod === 'email'
    });
  } catch (error) {
    next(error);
  }
};

export const getTenantInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const tokenHash = hashInviteToken(token);
    const invite = await prisma.tenantInvite.findUnique({
      where: { tokenHash },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        assignedProperty: { select: { id: true, propertyName: true, address: true } },
        assignedRoom: { select: { id: true, roomNumber: true, monthlyRent: true } },
        assignedBed: { select: { id: true, bedNumber: true } }
      }
    });

    if (!invite) {
      throw new AppError('Invitation link is invalid or has expired', 404);
    }

    if (invite.status !== 'pending' || invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('Invitation link is no longer active', 410);
    }

    const serialized = serialize(invite);

    return res.status(200).json({
      invite: {
        token,
        aadhaarNumber: serialized.aadhaarNumber,
        panNumber: serialized.panNumber,
        email: serialized.email,
        owner: serialized.owner,
        assignedProperty: serialized.assignedProperty,
        assignedRoom: serialized.assignedRoom,
        assignedBed: serialized.assignedBed,
        expiresAt: serialized.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const acceptTenantInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { fullName, email, phone, emergencyContact, occupation, address, panNumber } = req.body;
    const tokenHash = hashInviteToken(token);

    const invite = await prisma.tenantInvite.findUnique({ where: { tokenHash } });

    if (!invite) {
      throw new AppError('Invitation link is invalid or has expired', 404);
    }

    if (invite.status !== 'pending' || invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('Invitation link is no longer active', 410);
    }

    const ownerId = invite.ownerId;
    const latestLog = await prisma.verificationLog.findFirst({
      where: { aadhaarNumber: invite.aadhaarNumber, requesterId: ownerId },
      orderBy: { createdAt: 'desc' }
    });

    const verificationStatus = latestLog ? latestLog.status : 'pending';
    const riskLevel = latestLog ? latestLog.riskLevel : 'low';
    const tenantRating = latestLog ? ((latestLog.result as any)?.previousRating ?? 5.0) : 5.0;
    const creditScore = latestLog ? ((latestLog.result as any)?.creditScore ?? 700) : 700;
    const previousOwnerFeedback = latestLog
      ? ((latestLog.result as any)?.feedback ?? [])
      : ['No previous owner reviews registered.'];

    let tenant = await prisma.tenant.findFirst({ where: { aadhaarNumber: invite.aadhaarNumber } });

    const data: any = {
      fullName,
      email,
      phone,
      emergencyContact,
      occupation,
      address,
      verificationStatus,
      riskLevel,
      tenantRating,
      creditScore,
      previousOwnerFeedback
    };
    if (panNumber !== undefined) {
      data.panNumber = panNumber;
    } else if (invite.panNumber) {
      data.panNumber = invite.panNumber;
    }

    // Apply the bed the owner reserved on the invite. An existing tenant who is
    // still living somewhere else keeps that allocation untouched.
    let allocation: Awaited<ReturnType<typeof resolveAllocation>> = null;
    let moveInDate: Date | null = null;

    const inviteRoomId = invite.assignedRoomId;
    if (inviteRoomId) {
      if (tenant?.assignedRoomId && tenant.assignedRoomId !== inviteRoomId) {
        throw new AppError(
          'This Aadhaar number is already allocated to another room. Please contact the property owner.',
          409
        );
      }

      allocation = await resolveAllocation(
        ownerId,
        invite.assignedPropertyId ?? undefined,
        inviteRoomId,
        invite.assignedBedId ?? undefined,
        tenant?.id
      );

      data.assignedPropertyId = allocation!.property.id;
      data.assignedRoomId = allocation!.room.id;
      data.assignedBedId = allocation!.bed?.id ?? null;
      data.agreementStatus = allocation!.bed ? 'active' : 'pending';

      moveInDate = invite.joiningDate ? new Date(invite.joiningDate) : new Date();
      if (isNaN(moveInDate.getTime())) moveInDate = new Date();
      data.joiningDate = moveInDate;
    }

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          aadhaarNumber: invite.aadhaarNumber,
          panNumber: panNumber || invite.panNumber || '',
          ownerId,
          agreementStatus: 'pending',
          ...data
        }
      });
    } else {
      tenant = await prisma.tenant.update({ where: { id: tenant.id }, data });
    }

    if (allocation) {
      if (allocation.bed) {
        await prisma.bed.update({ where: { id: allocation.bed.id }, data: { isOccupied: true, tenantId: tenant.id } });
      }
      await updateRoomOccupancy(allocation.room.id);

      try {
        await createProratedInvoice(
          tenant.id,
          allocation.property.id,
          allocation.room.id,
          resolveTenantRent(tenant, allocation.room),
          moveInDate
        );
      } catch (err) {
        console.error('Error creating pro-rated joining invoice on invite acceptance:', err);
      }
    }

    // Create or activate TenantOwnerConnection
    let connection = await prisma.tenantOwnerConnection.findFirst({ where: { tenantId: tenant.id, ownerId } });
    if (!connection) {
      connection = await prisma.tenantOwnerConnection.create({
        data: { tenantId: tenant.id, ownerId, isDeleted: false }
      });
    } else {
      connection = await prisma.tenantOwnerConnection.update({
        where: { id: connection.id },
        data: { isDeleted: false }
      });
    }

    await prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted', acceptedTenantId: tenant.id }
    });

    return res.status(200).json({
      message: 'Tenant profile linked successfully',
      tenant: serialize(tenant)
    });
  } catch (error) {
    next(error);
  }
};

export const updateRoomOccupancy = async (roomId: string) => {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return;

  let occupancyStatus: 'vacant' | 'partially_occupied' | 'fully_occupied';

  if (room.roomType === 'flat') {
    const occupantsCount = await prisma.tenant.count({ where: { assignedRoomId: roomId } });
    if (occupantsCount === 0) {
      occupancyStatus = 'vacant';
    } else if (occupantsCount >= room.bedCapacity) {
      occupancyStatus = 'fully_occupied';
    } else {
      occupancyStatus = 'partially_occupied';
    }
  } else {
    const totalBeds = await prisma.bed.findMany({ where: { roomId } });
    const occupiedBedsCount = totalBeds.filter((b) => b.isOccupied).length;

    if (occupiedBedsCount === 0) {
      occupancyStatus = 'vacant';
    } else if (occupiedBedsCount >= room.bedCapacity) {
      occupancyStatus = 'fully_occupied';
    } else {
      occupancyStatus = 'partially_occupied';
    }
  }

  await prisma.room.update({ where: { id: roomId }, data: { occupancyStatus } });
};

export const addTenantCharge = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { description, amount } = req.body;

    const numericAmount = Number(amount);
    if (!description || !String(description).trim()) {
      throw new AppError('Description is required', 400);
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new AppError('Amount must be a number greater than zero', 400);
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    await assertTenantAccess(req, id, 'add a charge to this tenant');

    await prisma.tenantAdditionalCharge.create({
      data: { tenantId: id, description: String(description).trim(), amount: numericAmount }
    });

    const additionalCharges = await prisma.tenantAdditionalCharge.findMany({
      where: { tenantId: id },
      select: { id: true, description: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json({
      message: 'Additional charge added successfully',
      additionalCharges: serialize(additionalCharges)
    });
  } catch (error) {
    next(error);
  }
};

export const removeTenantCharge = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id, chargeId } = req.params;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    await assertTenantAccess(req, id, 'remove a charge from this tenant');

    await prisma.tenantAdditionalCharge.deleteMany({ where: { id: chargeId, tenantId: id } });

    const additionalCharges = await prisma.tenantAdditionalCharge.findMany({
      where: { tenantId: id },
      select: { id: true, description: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json({
      message: 'Additional charge removed successfully',
      additionalCharges: serialize(additionalCharges)
    });
  } catch (error) {
    next(error);
  }
};

export const sendTenantBillManually = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.userId;
    const owner = await prisma.user.findUnique({ where: { id: ownerId! } });
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        assignedProperty: { select: { id: true, propertyName: true, address: true } },
        assignedRoom: { select: { id: true, roomNumber: true, monthlyRent: true, roomType: true, bedCapacity: true } },
        additionalCharges: { select: { id: true, description: true, amount: true, createdAt: true } }
      }
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Verify owner connection
    await assertTenantAccess(req, tenant.id, 'bill this tenant');

    if (!tenant.email) {
      throw new AppError('This tenant has no email address on file, so the bill cannot be sent. Add one to their profile first.', 400);
    }

    if (!tenant.assignedRoom) {
      throw new AppError('Tenant is not allocated to a room, so no rent can be billed', 400);
    }

    const baseRent = resolveTenantRent(tenant, tenant.assignedRoom);

    const additionalCharges = tenant.additionalCharges || [];
    const additionalTotal = additionalCharges.reduce((sum, c) => sum + c.amount, 0);
    const totalAmount = baseRent + additionalTotal;

    if (totalAmount <= 0) {
      throw new AppError('This tenant has nothing to bill. Set a rent on their room or add a charge first.', 400);
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[new Date().getMonth()];
    const currentYear = new Date().getFullYear();

    // Rent is due on the 5th; if that has already passed this month the bill is
    // payable immediately rather than being created already overdue.
    const now = new Date();
    const fifth = new Date(now.getFullYear(), now.getMonth(), 5, 23, 59, 59, 999);
    const dueDate = fifth.getTime() < now.getTime() ? now : fifth;

    let description = `Rent Invoice for ${currentMonthName} ${currentYear}.\nBase Rent: ₹${baseRent}\n`;
    if (additionalCharges.length > 0) {
      description += `Additional Charges:\n` + additionalCharges.map((c) => `- ${c.description}: ₹${c.amount}`).join('\n') + `\n`;
    }
    description += `Total: ₹${totalAmount}`;

    // 1. Create a Payment (Invoice) record
    const payment = await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        propertyId: tenant.assignedPropertyId || null,
        roomId: tenant.assignedRoomId || null,
        amount: totalAmount,
        dueDate,
        status: 'unpaid',
        paymentMethod: 'none',
        transactionId: null,
        notes: description
      }
    });

    // 2. Send email to tenant
    const emailContent = buildRentBillEmail({
      tenantName: tenant.fullName,
      ownerName: owner.fullName,
      email: tenant.email,
      monthName: `${currentMonthName} ${currentYear}`,
      baseRent,
      additionalCharges,
      totalAmount,
      paymentId: payment.id
    });

    await sendMail({
      to: tenant.email,
      subject: `Rent Bill for ${currentMonthName} ${currentYear} - ₹${totalAmount.toLocaleString('en-IN')}`,
      text: emailContent.text,
      html: emailContent.html
    });

    // 3. Clear additionalCharges from tenant record
    await prisma.tenantAdditionalCharge.deleteMany({ where: { tenantId: tenant.id } });

    return res.status(200).json({
      message: `Rent bill sent successfully to ${tenant.email}`,
      payment: serialize(payment)
    });
  } catch (error) {
    next(error);
  }
};
