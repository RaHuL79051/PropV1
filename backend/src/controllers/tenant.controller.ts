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
    throw new AppError(`Payment required: You have unpaid persons. Please clear your dues to use portal services.`, 402);
  }
};

const getFrontendUrl = (req?: Request) => {
  const requestOrigin = req?.headers.origin?.toString().replace(/\/+$/, '');
  return requestOrigin || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
};

const hashInviteToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const createProratedInvoice = async (
  tenantId: string,
  propertyId: string,
  roomId: string,
  monthlyRent: number,
  joiningDateInput: Date | string | null | undefined
) => {
  if (!joiningDateInput) return null;
  const joiningDate = new Date(joiningDateInput);
  if (isNaN(joiningDate.getTime())) return null;

  const year = joiningDate.getFullYear();
  const month = joiningDate.getMonth();

  const N = new Date(year, month + 1, 0).getDate();
  const D = joiningDate.getDate();

  let remainingDays = N;
  if (D > 1) {
    remainingDays = N - D;
  }

  const proratedAmount = Math.round((monthlyRent / N) * remainingDays);

  if (proratedAmount <= 0) return null;

  const payment = await Payment.create({
    tenant: tenantId,
    property: propertyId,
    room: roomId,
    amount: proratedAmount,
    dueDate: joiningDate,
    status: 'unpaid',
    paymentMethod: 'none',
    transactionId: null
  });

  return payment;
};

export const createTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      fullName,
      aadhaarNumber,
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

    // Check unpaid persons limit if assigning room or bed
    if ((assignedRoom || assignedBed) && req.user?.role !== 'admin') {
      await checkUnpaidPersonsLimit(ownerId);
    }

    // Check if tenant exists globally
    let tenant = await Tenant.findOne({ aadhaarNumber });
    let connection = tenant ? await TenantOwnerConnection.findOne({ tenant: tenant._id, owner: ownerId }) : null;

    if (connection && !connection.isDeleted) {
      throw new AppError('Tenant with this Aadhaar number already exists in your registry', 400);
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
        rentAmount: rentAmount || null,
        joiningDate: joiningDate ? new Date(joiningDate) : null
      });
    } else {
      // Update tenant details if they already exist globally
      tenant.fullName = fullName || tenant.fullName;
      tenant.email = email || tenant.email;
      tenant.phone = phone || tenant.phone;
      tenant.emergencyContact = emergencyContact || tenant.emergencyContact;
      tenant.occupation = occupation || tenant.occupation;
      tenant.address = address || tenant.address;
      tenant.rentAmount = rentAmount || tenant.rentAmount;
      tenant.joiningDate = joiningDate ? new Date(joiningDate) : tenant.joiningDate;
    }

    if (assignedProperty) {
      tenant.assignedProperty = assignedProperty;
    }
    if (assignedRoom) {
      tenant.assignedRoom = assignedRoom;
      tenant.joiningDate = joiningDate ? new Date(joiningDate) : new Date();

      // Create prorated invoice
      const room = await Room.findById(assignedRoom);
      if (room) {
        if (room.roomType === 'flat') {
          const occupants = await Tenant.countDocuments({ assignedRoom: room._id });
          if (occupants >= room.bedCapacity) {
             throw new AppError('Flat has reached its maximum capacity', 400);
          }
        }
        const defaultRent = room.roomType === 'flat'
          ? Math.round(room.monthlyRent / (room.bedCapacity || 1))
          : room.monthlyRent;
        await createProratedInvoice(tenant._id.toString(), assignedProperty, assignedRoom, tenant.rentAmount || defaultRent, tenant.joiningDate);
      }
    }
    if (assignedBed) {
      // Check if bed is available
      const bed = await Bed.findById(assignedBed);
      if (!bed || (bed.isOccupied && bed.tenant?.toString() !== tenant._id.toString())) {
        throw new AppError('The selected bed is already occupied or does not exist', 400);
      }

      tenant.assignedBed = assignedBed;
      tenant.agreementStatus = 'pending';

      // Update Bed status
      bed.isOccupied = true;
      bed.tenant = tenant._id;
      await bed.save();

      if (assignedRoom) {
        // Update Room status
        await updateRoomOccupancy(assignedRoom);
      }
    } else if (assignedRoom) {
      const room = await Room.findById(assignedRoom);
      if (room?.roomType === 'flat') {
        tenant.agreementStatus = 'pending';
        await updateRoomOccupancy(assignedRoom);
      }
    }

    await tenant.save();

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
      throw new AppError('Tenant not found with this Aadhaar number', 404);
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
        throw new AppError('Unauthorized access to tenant details', 403);
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
      phone,
      emergencyContact,
      occupation,
      address,
      assignedProperty,
      assignedRoom,
      assignedBed,
      rentAmount
    } = req.body;
    const ownerId = req.user?.userId;

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: ownerId, isDeleted: false });
      if (!connection) {
        throw new AppError('Unauthorized update attempt', 403);
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
    tenant.email = req.body.email || tenant.email;
    tenant.phone = phone || tenant.phone;
    tenant.emergencyContact = emergencyContact || tenant.emergencyContact;
    tenant.occupation = occupation || tenant.occupation;
    tenant.address = address || tenant.address;
    if (rentAmount !== undefined) {
      tenant.rentAmount = rentAmount || null;
    }

    // Handle Property/Room/Bed reassignments
    const oldBedId = tenant.assignedBed;
    const oldRoomId = tenant.assignedRoom;

    let allocationChanged = false;

    if (assignedProperty !== undefined && assignedProperty !== (tenant.assignedProperty?.toString() || null)) {
      tenant.assignedProperty = assignedProperty || null;
      allocationChanged = true;
    }

    if (assignedRoom !== undefined && assignedRoom !== (oldRoomId?.toString() || null)) {
      tenant.assignedRoom = assignedRoom || null;
      allocationChanged = true;
      if (assignedRoom) {
        const room = await Room.findById(assignedRoom);
        if (room?.roomType === 'flat') {
          const occupants = await Tenant.countDocuments({ assignedRoom: room._id, _id: { $ne: tenant._id } });
          if (occupants >= room.bedCapacity) {
             throw new AppError('Flat has reached its maximum capacity', 400);
          }
        }
      }
    }

    if (assignedBed !== undefined && assignedBed !== (oldBedId?.toString() || null)) {
      // Release old bed
      if (oldBedId) {
        await Bed.findByIdAndUpdate(oldBedId, { $set: { isOccupied: false, tenant: null } });
      }

      // Assign new bed
      if (assignedBed) {
        const newBed = await Bed.findById(assignedBed);
        if (!newBed || (newBed.isOccupied && newBed.tenant?.toString() !== tenant._id.toString())) {
          throw new AppError('Selected bed is already occupied or invalid', 400);
        }
        newBed.isOccupied = true;
        newBed.tenant = tenant._id;
        await newBed.save();
        tenant.assignedBed = assignedBed;
      } else {
        tenant.assignedBed = null;
      }
      allocationChanged = true;
    }

    if (allocationChanged) {
      if (tenant.assignedBed) {
        tenant.agreementStatus = 'active';
      } else if (tenant.assignedRoom) {
        tenant.agreementStatus = 'pending';
      } else {
        tenant.agreementStatus = 'pending';
      }

      // Update room occupancy states
      if (oldRoomId) await updateRoomOccupancy(oldRoomId.toString());
      if (tenant.assignedRoom) await updateRoomOccupancy(tenant.assignedRoom.toString());
    }

    await tenant.save();
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
        throw new AppError('Unauthorized delete attempt', 403);
      }

      // Release bed if assigned
      if (tenant.assignedBed) {
        await Bed.findByIdAndUpdate(tenant.assignedBed, { $set: { isOccupied: false, tenant: null } });
      }

      // Update room occupancy
      if (tenant.assignedRoom) {
        const roomId = tenant.assignedRoom.toString();
        setTimeout(async () => {
          await updateRoomOccupancy(roomId);
        }, 100);
      }

      // Soft delete the connection
      connection.isDeleted = true;
      await connection.save();

      // Clear space assignments
      tenant.assignedProperty = null;
      tenant.assignedRoom = null;
      tenant.assignedBed = null;
      tenant.agreementStatus = 'pending';
      await tenant.save();
    } else {
      // Admin deletes tenant globally
      if (tenant.assignedBed) {
        await Bed.findByIdAndUpdate(tenant.assignedBed, { $set: { isOccupied: false, tenant: null } });
      }
      if (tenant.assignedRoom) {
        const roomId = tenant.assignedRoom.toString();
        setTimeout(async () => {
          await updateRoomOccupancy(roomId);
        }, 100);
      }
      await TenantOwnerConnection.deleteMany({ tenant: id });
      await Tenant.findByIdAndDelete(id);
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

    if (rating === undefined || !feedback) {
      throw new AppError('Rating and feedback are required for checking out a tenant', 400);
    }

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await TenantOwnerConnection.findOne({ tenant: id, owner: ownerId, isDeleted: false });
      if (!connection) {
        throw new AppError('Unauthorized checkout attempt', 403);
      }
      await checkUnpaidPersonsLimit(ownerId!);
    }

    // Create a TenantReview linked to the Aadhaar number
    await TenantReview.create({
      aadhaarNumber: tenant.aadhaarNumber,
      tenantName: tenant.fullName,
      rating: Number(rating),
      feedback: String(feedback),
      owner: ownerId
    });

    const oldBedId = tenant.assignedBed;
    const oldRoomId = tenant.assignedRoom;

    // Release Bed if assigned
    if (oldBedId) {
      await Bed.findByIdAndUpdate(oldBedId, { $set: { isOccupied: false, tenant: null } });
    }

    // Update room occupancy
    if (oldRoomId) {
      await updateRoomOccupancy(oldRoomId.toString());
    }

    // Update tenant status
    tenant.assignedProperty = null;
    tenant.assignedRoom = null;
    tenant.assignedBed = null;
    tenant.agreementStatus = 'expired';
    
    await tenant.save();

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
        throw new AppError('Unauthorized document upload', 403);
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

    let targetEmail = email;
    const existingTenant = await Tenant.findOne({ aadhaarNumber });
    if (!targetEmail && existingTenant?.email) {
      targetEmail = existingTenant.email;
    }

    if (sendMethod === 'email' && !targetEmail) {
      throw new AppError('Tenant email is required to send an invitation', 400);
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
      email: targetEmail,
      tokenHash,
      status: 'pending',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
      assignedProperty: assignedProperty || null,
      assignedRoom: assignedRoom || null,
      assignedBed: assignedBed || null,
      joiningDate: joiningDate ? new Date(joiningDate) : null
    });

    const inviteUrl = `${getFrontendUrl(req)}/invite/${rawToken}`;

    if (sendMethod === 'email') {
      const subject = 'Property Manager invitation to complete your tenant profile';
      const inviteEmail = buildTenantInviteEmail({
        ownerName: String((req.user as any)?.fullName || 'Property Manager'),
        tenantEmail: targetEmail,
        inviteUrl,
        propertyName: (invite.assignedProperty as any)?.propertyName || null,
        roomNumber: (invite.assignedRoom as any)?.roomNumber || null,
        bedNumber: (invite.assignedBed as any)?.bedNumber || null
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
        throw new AppError(`Failed to send invitation email: ${mailError.message || 'SMTP Server Error'}`, 500);
      }
    }

    return res.status(201).json({
      message: sendMethod === 'email'
        ? 'Invitation link generated and sent successfully'
        : 'Invitation link generated successfully for WhatsApp',
      invite: {
        id: invite._id,
        aadhaarNumber: invite.aadhaarNumber,
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
    const { fullName, email, phone, emergencyContact, occupation, address } = req.body;
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

    const verificationStatus = latestLog ? latestLog.status : 'verified';
    const riskLevel = latestLog ? latestLog.riskLevel : 'low';
    const tenantRating = latestLog ? (latestLog.result.previousRating || 5.0) : 5.0;
    const creditScore = latestLog ? (latestLog.result.creditScore || 700) : 700;
    const previousOwnerFeedback = latestLog ? (latestLog.result.feedback || []) : ['No previous owner reviews registered.'];

    let tenant = await Tenant.findOne({ aadhaarNumber: invite.aadhaarNumber });
    if (!tenant) {
      tenant = new Tenant({
        aadhaarNumber: invite.aadhaarNumber,
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
    tenant.joiningDate = invite.joiningDate || new Date();

    tenant.verificationStatus = verificationStatus;
    tenant.riskLevel = riskLevel;
    tenant.tenantRating = tenantRating;
    tenant.creditScore = creditScore;
    tenant.previousOwnerFeedback = previousOwnerFeedback;

    if (invite.assignedProperty) {
      tenant.assignedProperty = invite.assignedProperty._id || invite.assignedProperty;
    }
    if (invite.assignedRoom) {
      tenant.assignedRoom = invite.assignedRoom._id || invite.assignedRoom;
    }

    if (invite.assignedBed) {
      const bedId = invite.assignedBed._id || invite.assignedBed;
      const bed = await Bed.findById(bedId);
      if (!bed) {
        throw new AppError('The reserved bed does not exist', 404);
      }
      
      // If the bed is occupied by someone else, throw error
      if (bed.isOccupied && bed.tenant && bed.tenant.toString() !== tenant._id.toString()) {
        throw new AppError('The reserved bed is no longer available', 400);
      }

      tenant.assignedBed = bedId;
      tenant.agreementStatus = 'pending';

      bed.isOccupied = true;
      bed.tenant = tenant._id;
      await bed.save();
    }

    await tenant.save();

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

    if (invite.assignedRoom) {
      await updateRoomOccupancy(invite.assignedRoom._id.toString());

      const room = await Room.findById(invite.assignedRoom._id);
      if (room && invite.assignedProperty) {
        const defaultRent = room.roomType === 'flat'
          ? Math.round(room.monthlyRent / (room.bedCapacity || 1))
          : room.monthlyRent;
        await createProratedInvoice(
          tenant._id.toString(),
          invite.assignedProperty._id.toString(),
          invite.assignedRoom._id.toString(),
          tenant.rentAmount || defaultRent,
          tenant.joiningDate
        );
      }
    }

    await tenant.save();

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

    if (!description || !amount) {
      throw new AppError('Description and amount are required', 400);
    }

    const tenant = await Tenant.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    tenant.additionalCharges = tenant.additionalCharges || [];
    tenant.additionalCharges.push({
      _id: new mongoose.Types.ObjectId(),
      description,
      amount: Number(amount),
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
    const connection = await TenantOwnerConnection.findOne({ tenant: tenant._id, owner: ownerId, isDeleted: false });
    if (!connection && req.user?.role !== 'admin') {
      throw new AppError('Unauthorized access to tenant billing', 403);
    }

    if (!tenant.email) {
      throw new AppError('Tenant email is required to send the bill', 400);
    }

    // Calculate base rent
    let baseRent: number;
    if (tenant.rentAmount !== null && tenant.rentAmount !== undefined) {
      baseRent = tenant.rentAmount;
    } else {
      const room = tenant.assignedRoom as any;
      if (room) {
        baseRent = room.roomType === 'flat'
          ? Math.round(room.monthlyRent / (room.bedCapacity || 1))
          : room.monthlyRent;
      } else {
        baseRent = 0;
      }
    }

    const additionalCharges = tenant.additionalCharges || [];
    const additionalTotal = additionalCharges.reduce((sum: number, c: any) => sum + c.amount, 0);
    const totalAmount = baseRent + additionalTotal;

    if (totalAmount <= 0) {
      throw new AppError('Tenant has zero or negative total billing amount', 400);
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[new Date().getMonth()];
    const currentYear = new Date().getFullYear();

    const dueDate = new Date();
    dueDate.setDate(5); // Due date is 5th of the month

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
