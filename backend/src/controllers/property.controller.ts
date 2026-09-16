import { Response, NextFunction } from 'express';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Bed from '../models/Bed.js';
import Tenant from '../models/Tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { checkUnpaidPersonsLimit, updateRoomOccupancy } from './tenant.controller.js';

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

    const property = await Property.create({
      propertyName,
      address: structuredAddress,
      description,
      images: images || ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'],
      totalRooms: requestedRooms,
      owner: ownerId
    });

    // Create default rooms
    const createdRooms = [];
    const capacity = roomType === 'flat' ? 4 : 2;
    for (let i = 1; i <= requestedRooms; i++) {
      const room = await Room.create({
        property: property._id,
        roomNumber: `Room-${100 + i}`,
        roomType,
        bedCapacity: capacity,
        occupancyStatus: 'vacant',
        monthlyRent: roomType === 'flat' ? 12000 : 5000 // Default rent for flat vs pg room
      });

      // Create beds for each room
      for (let b = 1; b <= capacity; b++) {
        await Bed.create({
          room: room._id,
          bedNumber: roomType === 'flat' ? `${room.roomNumber}-Occupant-${b}` : `${room.roomNumber}-Bed${b}`,
          tenant: null,
          isOccupied: false
        });
      }
      createdRooms.push(room);
    }

    return res.status(201).json({
      message: 'Property and default rooms/beds created successfully',
      property,
      rooms: createdRooms
    });
  } catch (error) {
    next(error);
  }
};

export const getProperties = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const query = req.user?.role === 'admin' ? {} : { owner: ownerId };
    
    const properties = await Property.find(query).populate('owner', 'fullName email phone');
    return res.status(200).json(properties);
  } catch (error) {
    next(error);
  }
};

export const getPropertyById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId) {
      throw new AppError('You do not have access to this property.', 403);
    }

    const rooms = await Room.find({ property: property._id });
    
    // Fetch beds for these rooms, fully populating the tenant details
    const roomIds = rooms.map(r => r._id);
    const beds = await Bed.find({ room: { $in: roomIds } }).populate('tenant');

    return res.status(200).json({
      property,
      rooms,
      beds
    });
  } catch (error) {
    next(error);
  }
};

export const updateProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { propertyName, address, description, images, totalRooms } = req.body;

    const property = await Property.findById(id);
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId) {
      throw new AppError('You can only update your own properties.', 403);
    }

    property.propertyName = propertyName || property.propertyName;
    if (address) {
      if (typeof address === 'string') {
        // Legacy compatibility: store as-is with city field
        property.address = { pincode: '', flatNo: '', area: address, landmark: '', city: '', state: '' } as any;
      } else {
        property.address = {
          pincode: address.pincode ?? property.address?.pincode ?? '',
          flatNo: address.flatNo ?? property.address?.flatNo ?? '',
          area: address.area ?? property.address?.area ?? '',
          landmark: address.landmark ?? property.address?.landmark ?? '',
          city: address.city ?? property.address?.city ?? '',
          state: address.state ?? property.address?.state ?? ''
        } as any;
      }
    }
    property.description = description !== undefined ? description : property.description;
    property.images = images || property.images;
    // totalRooms is derived from the rooms collection, never set directly.
    property.totalRooms = await Room.countDocuments({ property: property._id });

    await property.save();
    return res.status(200).json({ message: 'Property updated successfully', property });
  } catch (error) {
    next(error);
  }
};

export const deleteProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id);
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId) {
      throw new AppError('You can only delete your own properties.', 403);
    }

    // Clean up rooms, beds, and unassign tenants
    const rooms = await Room.find({ property: property._id });
    const roomIds = rooms.map(r => r._id);

    await Bed.deleteMany({ room: { $in: roomIds } });
    await Room.deleteMany({ property: property._id });
    
    // Clear tenant assignments
    await Tenant.updateMany(
      { assignedProperty: property._id },
      { $set: { assignedProperty: null, assignedRoom: null, assignedBed: null, agreementStatus: 'expired' } }
    );

    await Property.findByIdAndDelete(id);

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

    const property = await Property.findById(propertyId);
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId) {
      throw new AppError('You can only add rooms to your own properties.', 403);
    }

    const actualCapacity = bedCapacity;

    const roomData: any = {
      property: propertyId,
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

    const room = await Room.create(roomData);

    // Create beds
    const beds = [];
    for (let i = 1; i <= actualCapacity; i++) {
      const bed = await Bed.create({
        room: room._id,
        bedNumber: roomType === 'flat' ? `${room.roomNumber}-Occupant-${i}` : `${room.roomNumber}-Bed${i}`,
        tenant: null,
        isOccupied: false
      });
      beds.push(bed);
    }

    // Keep the stored count in step with the rooms that actually exist.
    property.totalRooms = await Room.countDocuments({ property: property._id });
    await property.save();

    return res.status(201).json({ room, beds });
  } catch (error) {
    next(error);
  }
};

export const updateRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { roomNumber, bedCapacity, monthlyRent, agreementDocName, agreementDocData, flatCategory, propertyType, preferredTenant, furnishedType } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    // Validate ownership
    const property = await Property.findById(room.property);
    if (!property || (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId)) {
      throw new AppError('You can only edit rooms in your own properties.', 403);
    }

    // Check unpaid person limits if uploading document
    if (agreementDocData !== undefined && req.user?.role !== 'admin' && property.owner) {
      await checkUnpaidPersonsLimit(property.owner.toString());
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

    room.roomNumber = roomNumber || room.roomNumber;
    room.monthlyRent = monthlyRent !== undefined ? monthlyRent : room.monthlyRent;
    if (agreementDocName !== undefined) room.agreementDocName = agreementDocName;
    if (agreementDocData !== undefined) room.agreementDocData = agreementDocData;
    if (flatCategory !== undefined) (room as any).flatCategory = flatCategory;
    if (propertyType !== undefined) (room as any).propertyType = propertyType;
    if (preferredTenant !== undefined) (room as any).preferredTenant = preferredTenant;
    if (furnishedType !== undefined) (room as any).furnishedType = furnishedType;

    if (bedCapacity !== undefined && bedCapacity !== room.bedCapacity) {
      const currentBeds = await Bed.find({ room: room._id });
      if (bedCapacity > room.bedCapacity) {
        // Add more beds
        for (let i = room.bedCapacity + 1; i <= bedCapacity; i++) {
          await Bed.create({
            room: room._id,
            bedNumber: room.roomType === 'flat' ? `${room.roomNumber}-Occupant-${i}` : `${room.roomNumber}-Bed${i}`,
            tenant: null,
            isOccupied: false
          });
        }
      } else {
        // Check if removing beds would dislodge occupied beds
        const occupiedBedsCount = currentBeds.filter(b => b.isOccupied).length;
        if (occupiedBedsCount > bedCapacity) {
          throw new AppError(`Bed capacity cannot be reduced below ${occupiedBedsCount}, the number of beds currently occupied.`, 409);
        }

        // Delete unoccupied beds
        let deletedCount = 0;
        const targetToDelete = room.bedCapacity - bedCapacity;
        for (const bed of currentBeds) {
          if (!bed.isOccupied && deletedCount < targetToDelete) {
            await Bed.findByIdAndDelete(bed._id);
            deletedCount++;
          }
        }
      }
      room.bedCapacity = bedCapacity;
    }

    await room.save();
    await updateRoomOccupancy(room._id.toString());
    return res.status(200).json({ message: 'Room updated successfully', room });
  } catch (error) {
    next(error);
  }
};

export const deleteRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    const property = await Property.findById(room.property);
    if (!property || (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId)) {
      throw new AppError('You can only delete rooms in your own properties.', 403);
    }

    // Check if any beds are occupied
    const occupiedBeds = await Bed.find({ room: room._id, isOccupied: true });
    if (occupiedBeds.length > 0) {
      throw new AppError(
        `This room still has ${occupiedBeds.length} occupied bed${occupiedBeds.length > 1 ? 's' : ''}. ` +
          'Move or check out those tenants before deleting it.',
        409
      );
    }

    await Bed.deleteMany({ room: room._id });
    await Room.findByIdAndDelete(roomId);

    property.totalRooms = await Room.countDocuments({ property: property._id });
    await property.save();

    return res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    next(error);
  }
};
