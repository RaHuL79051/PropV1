import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { serialize } from '../utils/serialize.js';

export const createMaintenanceRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { property, room, tenant, title, description, priority } = req.body;

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: tenant, ownerId: req.user?.userId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only raise tickets for tenants linked to your account.', 403);
      }
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        propertyId: property,
        roomId: room,
        tenantId: tenant,
        title,
        description,
        priority,
        status: 'pending',
        images: ['https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=800&q=80'] // Default maintenance stock placeholder
      }
    });

    return res.status(201).json({
      message: 'Maintenance ticket raised successfully',
      request: serialize(request)
    });
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    let where: any = {};
    if (req.user?.role !== 'admin') {
      const tenantConnections = await prisma.tenantOwnerConnection.findMany({
        where: { ownerId, isDeleted: false },
        select: { tenantId: true }
      });
      const tenantIds = tenantConnections.map((c) => c.tenantId);
      where = { tenantId: { in: tenantIds } };
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where,
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
        property:
          req.user?.role === 'admin'
            ? {
                select: {
                  id: true,
                  propertyName: true,
                  address: true,
                  owner: { select: { id: true, fullName: true, email: true } }
                }
              }
            : { select: { id: true, propertyName: true, address: true } },
        room: { select: { id: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(serialize(requests));
  } catch (error) {
    next(error);
  }
};

export const updateMaintenanceStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'pending' | 'in_progress' | 'resolved'

    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      throw new AppError('Invalid ticket status', 400);
    }

    const request = await prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!request) {
      throw new AppError('Maintenance ticket not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: request.tenantId, ownerId: req.user?.userId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only update tickets for tenants linked to your account.', 403);
      }
    }

    const updated = await prisma.maintenanceRequest.update({ where: { id }, data: { status } });

    return res.status(200).json({
      message: 'Ticket status updated successfully',
      request: serialize(updated)
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMaintenanceRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const request = await prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!request) {
      throw new AppError('Maintenance ticket not found', 404);
    }

    if (req.user?.role !== 'admin') {
      const ownerId = req.user?.userId;
      const connection = await prisma.tenantOwnerConnection.findFirst({
        where: { tenantId: request.tenantId, ownerId, isDeleted: false }
      });
      if (!connection) {
        throw new AppError('You can only delete tickets for tenants linked to your account.', 403);
      }
    }

    await prisma.maintenanceRequest.delete({ where: { id } });

    return res.status(200).json({
      message: 'Maintenance ticket deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
