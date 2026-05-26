import { Response, NextFunction } from 'express';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import Tenant from '../models/Tenant.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const createMaintenanceRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { property, room, tenant, title, description, priority } = req.body;

    const request = await MaintenanceRequest.create({
      property,
      room,
      tenant,
      title,
      description,
      priority,
      status: 'pending',
      images: ['https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=800&q=80'] // Default maintenance stock placeholder
    });

    return res.status(201).json({
      message: 'Maintenance ticket raised successfully',
      request
    });
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    let requests;
    if (req.user?.role === 'admin') {
      requests = await MaintenanceRequest.find()
        .populate('tenant', 'fullName phone')
        .populate({
          path: 'property',
          select: 'propertyName address owner',
          populate: { path: 'owner', select: 'fullName email' }
        })
        .populate('room', 'roomNumber');
    } else {
      const tenantConnections = await TenantOwnerConnection.find({ owner: ownerId, isDeleted: false }).select('tenant');
      const tenantIds = tenantConnections.map(c => c.tenant);

      requests = await MaintenanceRequest.find({ tenant: { $in: tenantIds } })
        .populate('tenant', 'fullName phone')
        .populate('property', 'propertyName address')
        .populate('room', 'roomNumber');
    }

    return res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
};

export const updateMaintenanceStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'pending' | 'in_progress' | 'resolved'

    const request = await MaintenanceRequest.findById(id);
    if (!request) {
      throw new AppError('Maintenance ticket not found', 404);
    }

    request.status = status;
    await request.save();

    return res.status(200).json({
      message: 'Ticket status updated successfully',
      request
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMaintenanceRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const request = await MaintenanceRequest.findById(id);
    if (!request) {
      throw new AppError('Maintenance ticket not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const ownerId = req.user?.userId;
      const connection = await TenantOwnerConnection.findOne({
        tenant: request.tenant,
        owner: ownerId,
        isDeleted: false
      });
      if (!connection) {
        throw new AppError('Unauthorized to delete this maintenance ticket', 403);
      }
    }

    await MaintenanceRequest.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Maintenance ticket deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
