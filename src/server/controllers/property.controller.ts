import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { serialize } from '../utils/serialize';
import { checkUnpaidPersonsLimit, updateRoomOccupancy } from './tenant.controller';

export const createProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyName, address, description, images, totalRooms = 0, roomType = 'pg', ownerId: bodyOwnerId } = req.body;
    const ownerId = req.user?.role === 'admin' && bodyOwnerId ? bodyOwnerId : req.user?.userId;

    // Build structured address object
    const structuredAddress = typeof address === 'string'
      ? { pincode: '', flatNo: '', area: '', landmark: '', city: '', state: '', _legacy: address }
      : {
          pincode: address?.pincode || '',
          flatNo: address?.flatNo || '',
          area: address?.area || '',
          landmark: address?.landmark || '',
          city: address?.city || '',
          state: address?.state || ''
        };

    const requestedRooms = Number(totalRooms) || 0;
    if (requestedRooms < 0 || requestedRooms > 200) {
      throw new AppError('Total rooms must be between 0 and 200', 400);
    }

    const property = await prisma.property.create({
      data: {
        propertyName,
        address: structuredAddress,
        description,
        images: images || ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'],
        totalRooms: requestedRooms,
        ownerId
      }
    });

    // Create default rooms
    const createdRooms = [];
    const capacity = roomType === 'flat' ? 4 : 2;
    for (let i = 1; i <= requestedRooms; i++) {
      const room = await prisma.room.create({
        data: {
          propertyId: property.id,
          roomNumber: `Room-${100 + i}`,
          roomType,
          bedCapacity: capacity,
          occupancyStatus: 'vacant',
          monthlyRent: roomType === 'flat' ? 12000 : 5000 // Default rent for flat vs pg room
        }
      });

      // Create beds for each room
      for (let b = 1; b <= capacity; b++) {
        await prisma.bed.create({
          data: {
            roomId: room.id,
            bedNumber: roomType === 'flat' ? `${room.roomNumber}-Occupant-${b}` : `${room.roomNumber}-Bed${b}`,
            tenantId: null,
            isOccupied: false
          }
        });
      }
      createdRooms.push(room);
    }

    return res.status(201).json({
      message: 'Property and default rooms/beds created successfully',
      property: serialize(property),
      rooms: serialize(createdRooms)
    });
  } catch (error) {
    next(error);
  }
};

export const getProperties = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const where = req.user?.role === 'admin' ? {} : (ownerId ? { ownerId } : { id: '00000000-0000-0000-0000-000000000000' });

    const properties = await prisma.property.findMany({
      where,
      include: { owner: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    }).catch((err) => {
      console.error('[Properties] Error fetching properties from database:', err);
      return [];
    });
    return res.status(200).json(serialize(properties));
  } catch (error) {
    next(error);
  }
};

export const getPropertyById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const property = await prisma.property.findUnique({ where: { id } });

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.ownerId !== req.user?.userId) {
      throw new AppError('You do not have access to this property.', 403);
    }

    const rooms = await prisma.room.findMany({ where: { propertyId: property.id } });

    // Fetch beds for these rooms, fully populating the tenant details
    const roomIds = rooms.map((r) => r.id);
    const beds = await prisma.bed.findMany({
      where: { roomId: { in: roomIds } },
      include: { tenant: true }
    });

    return res.status(200).json({
      property: serialize(property),
      rooms: serialize(rooms),
      beds: serialize(beds)
    });
  } catch (error) {
    next(error);
  }
};

export const updateProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { propertyName, address, description, images, totalRooms } = req.body;

    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.ownerId !== req.user?.userId) {
      throw new AppError('You can only update your own properties.', 403);
    }

    const existingAddress = (property.address as any) || {};
    let newAddress = existingAddress;
    if (address) {
      if (typeof address === 'string') {
        // Legacy compatibility: store as-is with city field
        newAddress = { pincode: '', flatNo: '', area: address, landmark: '', city: '', state: '' };
      } else {
        newAddress = {
          pincode: address.pincode ?? existingAddress?.pincode ?? '',
          flatNo: address.flatNo ?? existingAddress?.flatNo ?? '',
          area: address.area ?? existingAddress?.area ?? '',
          landmark: address.landmark ?? existingAddress?.landmark ?? '',
          city: address.city ?? existingAddress?.city ?? '',
          state: address.state ?? existingAddress?.state ?? ''
        };
      }
    }

    // totalRooms is derived from the rooms collection, never set directly.
    const roomCount = await prisma.room.count({ where: { propertyId: property.id } });

    const updated = await prisma.property.update({
      where: { id },
      data: {
        propertyName: propertyName || property.propertyName,
        address: newAddress,
        description: description !== undefined ? description : property.description,
        images: images || property.images,
        totalRooms: roomCount
      }
    });

    return res.status(200).json({ message: 'Property updated successfully', property: serialize(updated) });
  } catch (error) {
    next(error);
  }
};

export const deleteProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.ownerId !== req.user?.userId) {
      throw new AppError('You can only delete your own properties.', 403);
    }

    // Clean up rooms, beds, and unassign tenants
    const rooms = await prisma.room.findMany({ where: { propertyId: property.id } });
    const roomIds = rooms.map((r) => r.id);

    await prisma.bed.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { propertyId: property.id } });

    // Clear tenant assignments
    await prisma.tenant.updateMany({
      where: { assignedPropertyId: property.id },
      data: { assignedPropertyId: null, assignedRoomId: null, assignedBedId: null, agreementStatus: 'expired' }
    });

    await prisma.property.delete({ where: { id } });

    return res.status(200).json({ message: 'Property deleted and associated rooms/beds cleared.' });
  } catch (error) {
    next(error);
  }
};

// Rooms API
export const addRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = req.params;
    const { roomNumber, bedCapacity, monthlyRent, roomType = 'pg', flatCategory, propertyType, preferredTenant, furnishedType } = req.body;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.ownerId !== req.user?.userId) {
      throw new AppError('You can only add rooms to your own properties.', 403);
    }

    const actualCapacity = bedCapacity;

    const roomData: any = {
      propertyId,
      roomNumber,
      roomType,
      bedCapacity: actualCapacity,
      occupancyStatus: 'vacant',
      monthlyRent
    };
    if (flatCategory) roomData.flatCategory = flatCategory;
    if (propertyType && propertyType.length) roomData.propertyType = propertyType;
    if (preferredTenant && preferredTenant.length) roomData.preferredTenant = preferredTenant;
    if (furnishedType) roomData.furnishedType = furnishedType;

    const room = await prisma.room.create({ data: roomData });

    // Create beds
    const beds = [];
    for (let i = 1; i <= actualCapacity; i++) {
      const bed = await prisma.bed.create({
        data: {
          roomId: room.id,
          bedNumber: roomType === 'flat' ? `${room.roomNumber}-Occupant-${i}` : `${room.roomNumber}-Bed${i}`,
          tenantId: null,
          isOccupied: false
        }
      });
      beds.push(bed);
    }

    // Keep the stored count in step with the rooms that actually exist.
    const roomCount = await prisma.room.count({ where: { propertyId: property.id } });
    await prisma.property.update({ where: { id: property.id }, data: { totalRooms: roomCount } });

    return res.status(201).json({ room: serialize(room), beds: serialize(beds) });
  } catch (error) {
    next(error);
  }
};

export const updateRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { roomNumber, bedCapacity, monthlyRent, agreementDocName, agreementDocData, flatCategory, propertyType, preferredTenant, furnishedType } = req.body;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    // Validate ownership
    const property = await prisma.property.findUnique({ where: { id: room.propertyId } });
    if (!property || (req.user?.role !== 'admin' && property.ownerId !== req.user?.userId)) {
      throw new AppError('You can only edit rooms in your own properties.', 403);
    }

    // Check unpaid person limits if uploading document
    if (agreementDocData !== undefined && req.user?.role !== 'admin' && property.ownerId) {
      await checkUnpaidPersonsLimit(property.ownerId);
    }

    if (typeof agreementDocData === 'string' && agreementDocData.length > 4 * 1024 * 1024) {
      throw new AppError('Agreement document is too large. Please upload a file under 3MB.', 413);
    }

    if (monthlyRent !== undefined && (isNaN(Number(monthlyRent)) || Number(monthlyRent) < 0)) {
      throw new AppError('Monthly rent must be a non-negative number', 400);
    }

    if (bedCapacity !== undefined && (!Number.isInteger(Number(bedCapacity)) || Number(bedCapacity) < 1)) {
      throw new AppError('Bed capacity must be a whole number of at least 1', 400);
    }

    const data: any = {
      roomNumber: roomNumber || room.roomNumber,
      monthlyRent: monthlyRent !== undefined ? monthlyRent : room.monthlyRent
    };
    if (agreementDocName !== undefined) data.agreementDocName = agreementDocName;
    if (agreementDocData !== undefined) data.agreementDocData = agreementDocData;
    if (flatCategory !== undefined) data.flatCategory = flatCategory;
    if (propertyType !== undefined) data.propertyType = propertyType;
    if (preferredTenant !== undefined) data.preferredTenant = preferredTenant;
    if (furnishedType !== undefined) data.furnishedType = furnishedType;

    if (bedCapacity !== undefined && bedCapacity !== room.bedCapacity) {
      const currentBeds = await prisma.bed.findMany({ where: { roomId: room.id } });
      if (bedCapacity > room.bedCapacity) {
        // Add more beds
        for (let i = room.bedCapacity + 1; i <= bedCapacity; i++) {
          await prisma.bed.create({
            data: {
              roomId: room.id,
              bedNumber: room.roomType === 'flat' ? `${room.roomNumber}-Occupant-${i}` : `${room.roomNumber}-Bed${i}`,
              tenantId: null,
              isOccupied: false
            }
          });
        }
      } else {
        // Check if removing beds would dislodge occupied beds
        const occupiedBedsCount = currentBeds.filter((b) => b.isOccupied).length;
        if (occupiedBedsCount > bedCapacity) {
          throw new AppError(`Bed capacity cannot be reduced below ${occupiedBedsCount}, the number of beds currently occupied.`, 409);
        }

        // Delete unoccupied beds
        let deletedCount = 0;
        const targetToDelete = room.bedCapacity - bedCapacity;
        for (const bed of currentBeds) {
          if (!bed.isOccupied && deletedCount < targetToDelete) {
            await prisma.bed.delete({ where: { id: bed.id } });
            deletedCount++;
          }
        }
      }
      data.bedCapacity = bedCapacity;
    }

    const updated = await prisma.room.update({ where: { id: roomId }, data });
    await updateRoomOccupancy(updated.id);
    return res.status(200).json({ message: 'Room updated successfully', room: serialize(updated) });
  } catch (error) {
    next(error);
  }
};

export const deleteRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    const property = await prisma.property.findUnique({ where: { id: room.propertyId } });
    if (!property || (req.user?.role !== 'admin' && property.ownerId !== req.user?.userId)) {
      throw new AppError('You can only delete rooms in your own properties.', 403);
    }

    // Check if any beds are occupied
    const occupiedBeds = await prisma.bed.findMany({ where: { roomId: room.id, isOccupied: true } });
    if (occupiedBeds.length > 0) {
      throw new AppError(
        `This room still has ${occupiedBeds.length} occupied bed${occupiedBeds.length > 1 ? 's' : ''}. ` +
          'Move or check out those tenants before deleting it.',
        409
      );
    }

    await prisma.bed.deleteMany({ where: { roomId: room.id } });
    await prisma.room.delete({ where: { id: roomId } });

    const roomCount = await prisma.room.count({ where: { propertyId: property.id } });
    await prisma.property.update({ where: { id: property.id }, data: { totalRooms: roomCount } });

    return res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    next(error);
  }
};
