import { Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Bed from '../models/Bed.js';
import User from '../models/User.js';
import TenantReview from '../models/TenantReview.js';
import TenantInvite from '../models/TenantInvite.js';
import Payment from '../models/Payment.js';
import VerificationLog from '../models/VerificationLog.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
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
  const connection = await TenantOwnerConnection.findOne({
    tenant: tenantId,
    owner: req.user?.userId,
    isDeleted: false
  });
  if (!connection) {
    throw new AppError(`Unauthorized attempt to ${action}`, 403);
  }
};

// Helper to get active tenant IDs for an owner
export const getOwnerTenantIds = async (ownerId: string): Promise<any[]> => {
  const connections = await TenantOwnerConnection.find({ owner: ownerId, isDeleted: false }).select('tenant');
  return connections.map(c => c.tenant);
};

// Helper to check if owner has unpaid persons
export const checkUnpaidPersonsLimit = async (ownerId: string) => {
  const owner = await User.findById(ownerId);
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  const totalTenants = await TenantOwnerConnection.countDocuments({ owner: ownerId, isDeleted: false });
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

// Reference fields may arrive raw or populated depending on the query.
const refId = (value: any): string | undefined => {
  if (!value) return undefined;
  return (value._id ?? value).toString();
};

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
  const existing = await Payment.findOne({
    tenant: tenantId,
    dueDate: { $gte: periodStart, $lte: periodEnd },
    notes: { $regex: '^Pro-rated joining rent' }
  });
  if (existing) return existing;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const notes =
    `Pro-rated joining rent for ${joinDay}-${daysInMonth} ${monthNames[month]} ${year}.\n` +
    `Monthly rent: ₹${monthlyRent} over ${daysInMonth} days.\n` +
    `Charged for ${remainingDays} day(s): ₹${proratedAmount}.`;

  const payment = await Payment.create({
    tenant: tenantId,
    property: propertyId,
    room: roomId,
    amount: proratedAmount,
    // Due at the end of the joining month; the regular cycle resets on the 1st.
    dueDate: periodEnd,
    status: 'unpaid',
    paymentMethod: 'none',
    transactionId: null,
    notes
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

  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Selected room could not be found', 404);

  const property = await Property.findById(propertyId || room.property);
  if (!property) throw new AppError('Selected property could not be found', 404);

  if (room.property.toString() !== property._id.toString()) {
    throw new AppError('Selected room does not belong to the selected property', 400);
  }
  if (property.owner.toString() !== ownerId.toString()) {
    throw new AppError('You can only allocate space in your own properties', 403);
  }

  let bed = null;
  if (bedId) {
    bed = await Bed.findById(bedId);
    if (!bed) throw new AppError('Selected bed could not be found', 404);
    if (bed.room.toString() !== room._id.toString()) {
      throw new AppError('Selected bed does not belong to the selected room', 400);
    }
    if (bed.isOccupied && (!tenantId || bed.tenant?.toString() !== tenantId.toString())) {
      throw new AppError('That bed is already occupied. Please choose a vacant one.', 409);
    }
  }

  if (room.roomType === 'flat') {
    const occupants = await Tenant.countDocuments({
      assignedRoom: room._id,
      ...(tenantId ? { _id: { $ne: tenantId } } : {})
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
    let tenant = await Tenant.findOne({ aadhaarNumber });
    let connection = tenant ? await TenantOwnerConnection.findOne({ tenant: tenant._id, owner: ownerId }) : null;

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
      ? await resolveAllocation(ownerId, assignedProperty, assignedRoom, assignedBed, tenant?._id?.toString())
      : null;

    if (allocation && tenant && tenant.assignedRoom && tenant.assignedRoom.toString() !== assignedRoom) {
      throw new AppError('This tenant is already occupying a room under another owner and cannot be allocated here', 400);
    }

    const latestLog = await VerificationLog.findOne({
      aadhaarNumber,
      requester: ownerId
    }).sort({ createdAt: -1 });

    const verificationStatus = latestLog ? latestLog.status : 'verified';
    const riskLevel = latestLog ? latestLog.riskLevel : 'low';
    const tenantRating = latestLog ? (latestLog.result.previousRating || 5.0) : 5.0;
    const creditScore = latestLog ? (latestLog.result.creditScore || 700) : 700;
    const previousOwnerFeedback = latestLog ? (latestLog.result.feedback || []) : ['No previous owner reviews registered.'];

    if (!tenant) {
      tenant = new Tenant({
        fullName,
        aadhaarNumber,
        panNumber: panNumber || '',
        email: email || '',
        phone,
        emergencyContact,
        occupation,
        address,
        owner: ownerId,
        agreementStatus: 'pending',
        verificationStatus,
        riskLevel,
        tenantRating,
        creditScore,
        previousOwnerFeedback,
        rentAmount: null,
        joiningDate: null
      });
    } else {
      // Update tenant details if they already exist globally
      tenant.fullName = fullName || tenant.fullName;
      tenant.panNumber = panNumber || tenant.panNumber || '';
      tenant.email = email || tenant.email;
      tenant.phone = phone || tenant.phone;
      tenant.emergencyContact = emergencyContact || tenant.emergencyContact;
      tenant.occupation = occupation || tenant.occupation;
      tenant.address = address || tenant.address;
    }

    // Apply the allocation, if one was supplied with the registration.
    let effectiveJoiningDate: Date | null = null;
    if (allocation) {
      tenant.assignedProperty = allocation.property._id as any;
      tenant.assignedRoom = allocation.room._id as any;
      tenant.assignedBed = (allocation.bed?._id as any) ?? null;
      tenant.agreementStatus = allocation.bed ? 'active' : 'pending';

      if (rentAmount !== undefined && rentAmount !== null && rentAmount !== '') {
        tenant.rentAmount = Number(rentAmount);
      }

      const parsedJoining = joiningDate ? new Date(joiningDate) : new Date();
      effectiveJoiningDate = isNaN(parsedJoining.getTime()) ? new Date() : parsedJoining;
      tenant.joiningDate = effectiveJoiningDate;
    }

    await tenant.save();

    if (allocation) {
      // Occupy the bed only once the tenant row is safely persisted.
      if (allocation.bed) {
        allocation.bed.isOccupied = true;
        allocation.bed.tenant = tenant._id as any;
        await allocation.bed.save();
      }
      await updateRoomOccupancy(allocation.room._id.toString());

      // Charge only for the days actually occupied in the joining month.
      try {
        await createProratedInvoice(
          tenant._id.toString(),
          allocation.property._id.toString(),
          allocation.room._id.toString(),
          resolveTenantRent(tenant, allocation.room),
          effectiveJoiningDate
        );
      } catch (err) {
        console.error('Error creating pro-rated joining invoice:', err);
      }
    }

    // Create or activate connection
    if (!connection) {
      connection = new TenantOwnerConnection({
        tenant: tenant._id,
        owner: ownerId,
        isDeleted: false
      });
    } else {
      connection.isDeleted = false;
    }
    await connection.save();

    try {
      await updateTenantStatsByAadhaar(tenant.aadhaarNumber);
    } catch (err) {
      console.error('Error updating tenant stats on creation:', err);
    }

    return res.status(201).json({
      message: 'Tenant created successfully',
      tenant
    });
  } catch (error) {
    next(error);
  }
};

export const getTenants = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    let query = {};
    if (req.user?.role !== 'admin') {
      const tenantIds = await getOwnerTenantIds(ownerId!);
      query = { _id: { $in: tenantIds } };
    }

    const tenants = await Tenant.find(query)
      .populate('owner', 'fullName email phone')
      .populate('assignedProperty', 'propertyName address')
      .populate('assignedRoom', 'roomNumber monthlyRent')
      .populate('assignedBed', 'bedNumber');

    return res.status(200).json(tenants);
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

    const tenant = await Tenant.findOne({ aadhaarNumber });
    if (!tenant) {
      throw new AppError('No tenant record exists for this Aadhaar number.', 404);
    }

    let connection = await TenantOwnerConnection.findOne({ tenant: tenant._id, owner: ownerId });
    if (!connection) {
      connection = new TenantOwnerConnection({
        tenant: tenant._id,
        owner: ownerId,
        isDeleted: false
      });
    } else {
      connection.isDeleted = false;
    }
    await connection.save();

    return res.status(200).json({
      message: 'Connection activated successfully',
      tenant
    });
  } catch (error) {
    next(error);
  }
};

export const getTenantById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findById(id)
      .populate('assignedProperty', 'propertyName address')
      .populate('assignedRoom', 'roomNumber monthlyRent')
      .populate('assignedBed', 'bedNumber');

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: req.user?.userId, isDeleted: false });
      if (!connection) {
        throw new AppError('You do not have access to this tenant.', 403);
      }
    }

    return res.status(200).json(tenant);
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

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: ownerId, isDeleted: false });
      if (!connection) {
        throw new AppError('You can only update tenants linked to your account.', 403);
      }
    }

    // Check unpaid persons limit if assigning a new room or bed
    if (req.user?.role !== 'admin' && ownerId && (
      (assignedBed !== undefined && assignedBed !== (tenant.assignedBed?.toString() || null)) || 
      (assignedRoom !== undefined && assignedRoom !== (tenant.assignedRoom?.toString() || null))
    )) {
      await checkUnpaidPersonsLimit(ownerId);
    }

    tenant.fullName = fullName || tenant.fullName;
    if (panNumber !== undefined) {
      tenant.panNumber = panNumber;
    }
    tenant.email = req.body.email || tenant.email;
    tenant.phone = phone || tenant.phone;
    tenant.emergencyContact = emergencyContact || tenant.emergencyContact;
    tenant.occupation = occupation || tenant.occupation;
    tenant.address = address || tenant.address;
    if (rentAmount !== undefined) {
      tenant.rentAmount = rentAmount || null;
    }
    if (verificationStatus !== undefined) {
      tenant.verificationStatus = verificationStatus;
    }

    // Handle Property/Room/Bed reassignments
    const oldBedId = tenant.assignedBed;
    const oldRoomId = tenant.assignedRoom;
    // A tenant with no room and no bed is moving in rather than moving around.
    const wasUnallocated = !oldRoomId && !oldBedId;

    let allocationChanged = false;

    // Validate the destination before mutating anything.
    const targetRoomId = assignedRoom !== undefined ? assignedRoom : oldRoomId?.toString() || null;
    const targetBedId = assignedBed !== undefined ? assignedBed : oldBedId?.toString() || null;
    const roomOrBedChanged =
      (assignedRoom !== undefined && assignedRoom !== (oldRoomId?.toString() || null)) ||
      (assignedBed !== undefined && assignedBed !== (oldBedId?.toString() || null));

    let allocation: Awaited<ReturnType<typeof resolveAllocation>> = null;
    if (roomOrBedChanged && targetRoomId) {
      const allocationOwnerId =
        req.user?.role === 'admin'
          ? (await Property.findById(assignedProperty ?? tenant.assignedProperty))?.owner?.toString() || ownerId
          : ownerId;
      allocation = await resolveAllocation(
        allocationOwnerId!,
        assignedProperty ?? tenant.assignedProperty?.toString(),
        targetRoomId,
        targetBedId,
        tenant._id.toString()
      );
    }

    if (assignedProperty !== undefined && assignedProperty !== (tenant.assignedProperty?.toString() || null)) {
      tenant.assignedProperty = assignedProperty || null;
      allocationChanged = true;
    }

    if (assignedRoom !== undefined && assignedRoom !== (oldRoomId?.toString() || null)) {
      tenant.assignedRoom = assignedRoom || null;
      allocationChanged = true;
    }

    if (assignedBed !== undefined && assignedBed !== (oldBedId?.toString() || null)) {
      // Release old bed
      if (oldBedId) {
        await Bed.findByIdAndUpdate(oldBedId, { $set: { isOccupied: false, tenant: null } });
      }

      // Assign new bed (already validated above)
      if (assignedBed) {
        await Bed.findByIdAndUpdate(assignedBed, { $set: { isOccupied: true, tenant: tenant._id } });
        tenant.assignedBed = assignedBed;
      } else {
        tenant.assignedBed = null;
      }
      allocationChanged = true;
    }

    // Dropping the room without naming a bed must still free the bed behind it.
    if (allocationChanged && !tenant.assignedRoom && tenant.assignedBed) {
      await Bed.findByIdAndUpdate(tenant.assignedBed, { $set: { isOccupied: false, tenant: null } });
      tenant.assignedBed = null;
    }

    let moveInDate: Date | null = null;
    if (allocationChanged) {
      tenant.agreementStatus = tenant.assignedBed ? 'active' : 'pending';

      if (!tenant.assignedRoom && !tenant.assignedBed) {
        // Fully unassigned: clear the move-in date so a future allocation re-prorates.
        tenant.joiningDate = null;
      } else if (wasUnallocated) {
        const parsedJoining = joiningDate ? new Date(joiningDate) : new Date();
        moveInDate = isNaN(parsedJoining.getTime()) ? new Date() : parsedJoining;
        tenant.joiningDate = moveInDate;
      }
    }

    await tenant.save();

    if (allocationChanged) {
      // Update room occupancy states
      if (oldRoomId) await updateRoomOccupancy(oldRoomId.toString());
      if (tenant.assignedRoom) await updateRoomOccupancy(tenant.assignedRoom.toString());

      // First allocation for this tenant: bill only the days they will occupy.
      if (moveInDate && allocation) {
        try {
          await createProratedInvoice(
            tenant._id.toString(),
            allocation.property._id.toString(),
            allocation.room._id.toString(),
            resolveTenantRent(tenant, allocation.room),
            moveInDate
          );
        } catch (err) {
          console.error('Error creating pro-rated joining invoice:', err);
        }
      }
    }
    return res.status(200).json({ message: 'Tenant updated successfully', tenant });
  } catch (error) {
    next(error);
  }
};

export const deleteTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.userId;

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: ownerId, isDeleted: false });
      if (!connection) {
        throw new AppError('You can only remove tenants linked to your account.', 403);
      }

      const releasedRoomId = tenant.assignedRoom?.toString() || null;

      // Release bed if assigned
      if (tenant.assignedBed) {
        await Bed.findByIdAndUpdate(tenant.assignedBed, { $set: { isOccupied: false, tenant: null } });
      }

      // Soft delete the connection
      connection.isDeleted = true;
      await connection.save();

      // Clear space assignments
      tenant.assignedProperty = null;
      tenant.assignedRoom = null;
      tenant.assignedBed = null;
      tenant.agreementStatus = 'pending';
      tenant.rentAmount = null;
      tenant.joiningDate = null;
      await tenant.save();

      // Recompute only after the tenant no longer points at the room.
      if (releasedRoomId) {
        await updateRoomOccupancy(releasedRoomId);
      }
    } else {
      // Admin deletes tenant globally
      const releasedRoomId = tenant.assignedRoom?.toString() || null;
      if (tenant.assignedBed) {
        await Bed.findByIdAndUpdate(tenant.assignedBed, { $set: { isOccupied: false, tenant: null } });
      }
      await TenantOwnerConnection.deleteMany({ tenant: id });
      await Tenant.findByIdAndDelete(id);
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

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: ownerId, isDeleted: false });
      if (!connection) {
        throw new AppError('You can only check out tenants linked to your account.', 403);
      }
      await checkUnpaidPersonsLimit(ownerId!);

      // Soft delete the connection so it is removed from the owner's registry
      connection.isDeleted = true;
      await connection.save();
    } else {
      // For admin, soft-delete all active connections for this tenant
      await TenantOwnerConnection.updateMany({ tenant: id, isDeleted: false }, { $set: { isDeleted: true } });
    }

    // Create a TenantReview linked to the Aadhaar number
    await TenantReview.create({
      aadhaarNumber: tenant.aadhaarNumber,
      tenantName: tenant.fullName,
      rating: numericRating,
      feedback: String(feedback).trim(),
      owner: ownerId
    });

    const oldBedId = tenant.assignedBed;
    const oldRoomId = tenant.assignedRoom;

    // Release Bed if assigned
    if (oldBedId) {
      await Bed.findByIdAndUpdate(oldBedId, { $set: { isOccupied: false, tenant: null } });
    }

    // Update tenant status
    tenant.assignedProperty = null;
    tenant.assignedRoom = null;
    tenant.assignedBed = null;
    tenant.agreementStatus = 'expired';
    // Clearing these stops the monthly scheduler from billing a departed tenant.
    tenant.rentAmount = null;
    tenant.joiningDate = null;
    tenant.additionalCharges = [];

    await tenant.save();

    // Update room occupancy
    if (oldRoomId) {
      await updateRoomOccupancy(oldRoomId.toString());
    }

    try {
      await updateTenantStatsByAadhaar(tenant.aadhaarNumber);
    } catch (err) {
      console.error('Error updating tenant stats on checkout:', err);
    }

    return res.status(200).json({
      message: 'Tenant checked out successfully and review recorded',
      tenant
    });
  } catch (error) {
    next(error);
  }
};

export const uploadDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.userId;
    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: ownerId, isDeleted: false });
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

    // Documents are stored inline as base64, and a MongoDB document is capped at
    // 16MB, so reject anything that would push the tenant record over the edge.
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

    if (!tenant.documents) {
      tenant.documents = {};
    }

    if (aadhaarDocName !== undefined) tenant.documents.aadhaarDocName = aadhaarDocName;
    if (aadhaarDocData !== undefined) tenant.documents.aadhaarDocData = aadhaarDocData;
    if (agreementDocName !== undefined) tenant.documents.agreementDocName = agreementDocName;
    if (agreementDocData !== undefined) tenant.documents.agreementDocData = agreementDocData;
    if (photoDocName !== undefined) tenant.documents.photoDocName = photoDocName;
    if (photoDocData !== undefined) tenant.documents.photoDocData = photoDocData;

    tenant.markModified('documents');
    await tenant.save();

    return res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: tenant.documents
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
    const existingTenant = await Tenant.findOne({ aadhaarNumber });
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
    const invite = await TenantInvite.create({
      owner: ownerId,
      aadhaarNumber,
      panNumber: panNumber || '',
      email: targetEmail,
      tokenHash,
      status: 'pending',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
      assignedProperty: allocation?.property._id ?? null,
      assignedRoom: allocation?.room._id ?? null,
      assignedBed: allocation?.bed?._id ?? null,
      joiningDate: inviteJoiningDate
    });

    const inviteUrl = `${getFrontendUrl(req)}/invite/${rawToken}`;

    if (sendMethod === 'email') {
      const subject = 'Property Manager invitation to complete your tenant profile';
      const owner = await User.findById(ownerId).select('fullName');
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
        id: invite._id,
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
    const invite = await TenantInvite.findOne({ tokenHash })
      .populate('owner', 'fullName email')
      .populate('assignedProperty', 'propertyName address')
      .populate('assignedRoom', 'roomNumber monthlyRent')
      .populate('assignedBed', 'bedNumber');

    if (!invite) {
      throw new AppError('Invitation link is invalid or has expired', 404);
    }

    if (invite.status !== 'pending' || invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('Invitation link is no longer active', 410);
    }

    return res.status(200).json({
      invite: {
        token,
        aadhaarNumber: invite.aadhaarNumber,
        panNumber: invite.panNumber,
        email: invite.email,
        owner: invite.owner,
        assignedProperty: invite.assignedProperty,
        assignedRoom: invite.assignedRoom,
        assignedBed: invite.assignedBed,
        expiresAt: invite.expiresAt
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

    const invite = await TenantInvite.findOne({ tokenHash })
      .populate('owner')
      .populate('assignedProperty')
      .populate('assignedRoom')
      .populate('assignedBed');

    if (!invite) {
      throw new AppError('Invitation link is invalid or has expired', 404);
    }

    if (invite.status !== 'pending' || invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('Invitation link is no longer active', 410);
    }

    const ownerId = invite.owner._id.toString();
    const latestLog = await VerificationLog.findOne({
      aadhaarNumber: invite.aadhaarNumber,
      requester: ownerId
    }).sort({ createdAt: -1 });

    const verificationStatus = latestLog ? latestLog.status : 'pending';
    const riskLevel = latestLog ? latestLog.riskLevel : 'low';
    const tenantRating = latestLog ? (latestLog.result.previousRating || 5.0) : 5.0;
    const creditScore = latestLog ? (latestLog.result.creditScore || 700) : 700;
    const previousOwnerFeedback = latestLog ? (latestLog.result.feedback || []) : ['No previous owner reviews registered.'];

    let tenant = await Tenant.findOne({ aadhaarNumber: invite.aadhaarNumber });
    if (!tenant) {
      tenant = new Tenant({
        aadhaarNumber: invite.aadhaarNumber,
        panNumber: panNumber || invite.panNumber || '',
        owner: ownerId,
        agreementStatus: 'pending',
        verificationStatus
      });
    }

    tenant.fullName = fullName;
    tenant.email = email;
    tenant.phone = phone;
    tenant.emergencyContact = emergencyContact;
    tenant.occupation = occupation;
    tenant.address = address;
    if (panNumber !== undefined) {
      tenant.panNumber = panNumber;
    } else if (invite.panNumber) {
      tenant.panNumber = invite.panNumber;
    }

    tenant.verificationStatus = verificationStatus;
    tenant.riskLevel = riskLevel;
    tenant.tenantRating = tenantRating;
    tenant.creditScore = creditScore;
    tenant.previousOwnerFeedback = previousOwnerFeedback;

    // Apply the bed the owner reserved on the invite. An existing tenant who is
    // still living somewhere else keeps that allocation untouched.
    let allocation: Awaited<ReturnType<typeof resolveAllocation>> = null;
    let moveInDate: Date | null = null;

    const inviteRoomId = refId(invite.assignedRoom);
    if (inviteRoomId) {
      if (tenant.assignedRoom && tenant.assignedRoom.toString() !== inviteRoomId) {
        throw new AppError(
          'This Aadhaar number is already allocated to another room. Please contact the property owner.',
          409
        );
      }

      allocation = await resolveAllocation(
        ownerId,
        refId(invite.assignedProperty),
        inviteRoomId,
        refId(invite.assignedBed),
        tenant._id.toString()
      );

      tenant.assignedProperty = allocation!.property._id as any;
      tenant.assignedRoom = allocation!.room._id as any;
      tenant.assignedBed = (allocation!.bed?._id as any) ?? null;
      tenant.agreementStatus = allocation!.bed ? 'active' : 'pending';

      moveInDate = invite.joiningDate ? new Date(invite.joiningDate) : new Date();
      if (isNaN(moveInDate.getTime())) moveInDate = new Date();
      tenant.joiningDate = moveInDate;
    }

    await tenant.save();

    if (allocation) {
      if (allocation.bed) {
        allocation.bed.isOccupied = true;
        allocation.bed.tenant = tenant._id as any;
        await allocation.bed.save();
      }
      await updateRoomOccupancy(allocation.room._id.toString());

      try {
        await createProratedInvoice(
          tenant._id.toString(),
          allocation.property._id.toString(),
          allocation.room._id.toString(),
          resolveTenantRent(tenant, allocation.room),
          moveInDate
        );
      } catch (err) {
        console.error('Error creating pro-rated joining invoice on invite acceptance:', err);
      }
    }

    // Create or activate TenantOwnerConnection
    let connection = await TenantOwnerConnection.findOne({ tenant: tenant._id, owner: ownerId });
    if (!connection) {
      connection = new TenantOwnerConnection({
        tenant: tenant._id,
        owner: ownerId,
        isDeleted: false
      });
    } else {
      connection.isDeleted = false;
    }
    await connection.save();

    invite.status = 'accepted';
    invite.acceptedTenant = tenant._id;
    await invite.save();

    return res.status(200).json({
      message: 'Tenant profile linked successfully',
      tenant
    });
  } catch (error) {
    next(error);
  }
};

export const updateRoomOccupancy = async (roomId: string) => {
  const room = await Room.findById(roomId);
  if (!room) return;

  if (room.roomType === 'flat') {
    const occupantsCount = await Tenant.countDocuments({ assignedRoom: roomId });
    if (occupantsCount === 0) {
      room.occupancyStatus = 'vacant';
    } else if (occupantsCount >= room.bedCapacity) {
      room.occupancyStatus = 'fully_occupied';
    } else {
      room.occupancyStatus = 'partially_occupied';
    }
  } else {
    const totalBeds = await Bed.find({ room: roomId });
    const occupiedBedsCount = totalBeds.filter(b => b.isOccupied).length;

    if (occupiedBedsCount === 0) {
      room.occupancyStatus = 'vacant';
    } else if (occupiedBedsCount >= room.bedCapacity) {
      room.occupancyStatus = 'fully_occupied';
    } else {
      room.occupancyStatus = 'partially_occupied';
    }
  }

  await room.save();
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

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    await assertTenantAccess(req, id, 'add a charge to this tenant');

    tenant.additionalCharges = tenant.additionalCharges || [];
    tenant.additionalCharges.push({
      _id: new mongoose.Types.ObjectId(),
      description: String(description).trim(),
      amount: numericAmount,
      createdAt: new Date()
    } as any);

    await tenant.save();

    return res.status(200).json({
      message: 'Additional charge added successfully',
      additionalCharges: tenant.additionalCharges
    });
  } catch (error) {
    next(error);
  }
};

export const removeTenantCharge = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id, chargeId } = req.params;

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    await assertTenantAccess(req, id, 'remove a charge from this tenant');

    tenant.additionalCharges = (tenant.additionalCharges || []).filter(
      (c: any) => c._id.toString() !== chargeId
    );

    await tenant.save();

    return res.status(200).json({
      message: 'Additional charge removed successfully',
      additionalCharges: tenant.additionalCharges
    });
  } catch (error) {
    next(error);
  }
};

export const sendTenantBillManually = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.userId;
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    const tenant = await Tenant.findById(id)
      .populate('assignedProperty', 'propertyName address')
      .populate('assignedRoom', 'roomNumber monthlyRent roomType bedCapacity');

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Verify owner connection
    await assertTenantAccess(req, tenant._id.toString(), 'bill this tenant');

    if (!tenant.email) {
      throw new AppError('This tenant has no email address on file, so the bill cannot be sent. Add one to their profile first.', 400);
    }

    if (!tenant.assignedRoom) {
      throw new AppError('Tenant is not allocated to a room, so no rent can be billed', 400);
    }

    const baseRent = resolveTenantRent(tenant, tenant.assignedRoom as any);

    const additionalCharges = tenant.additionalCharges || [];
    const additionalTotal = additionalCharges.reduce((sum: number, c: any) => sum + c.amount, 0);
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
      description += `Additional Charges:\n` + additionalCharges.map((c: any) => `- ${c.description}: ₹${c.amount}`).join('\n') + `\n`;
    }
    description += `Total: ₹${totalAmount}`;

    // 1. Create a Payment (Invoice) record
    const payment = await Payment.create({
      tenant: tenant._id,
      property: tenant.assignedProperty?._id || null,
      room: tenant.assignedRoom?._id || null,
      amount: totalAmount,
      dueDate,
      status: 'unpaid',
      paymentMethod: 'none',
      transactionId: null,
      notes: description
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
      paymentId: payment._id.toString()
    });

    await sendMail({
      to: tenant.email,
      subject: `Rent Bill for ${currentMonthName} ${currentYear} - ₹${totalAmount.toLocaleString('en-IN')}`,
      text: emailContent.text,
      html: emailContent.html
    });

    // 3. Clear additionalCharges from tenant record
    tenant.additionalCharges = [];
    await tenant.save();

    return res.status(200).json({
      message: `Rent bill sent successfully to ${tenant.email}`,
      payment
    });
  } catch (error) {
    next(error);
  }
};
