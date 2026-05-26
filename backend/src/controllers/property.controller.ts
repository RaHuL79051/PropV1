import { Response, NextFunction } from 'express';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Bed from '../models/Bed.js';
import Tenant from '../models/Tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { checkUnpaidPersonsLimit } from './tenant.controller.js';

export const createProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyName, address, description, images, totalRooms, roomType = 'pg', ownerId: bodyOwnerId } = req.body;
    const ownerId = req.user?.role === 'admin' && bodyOwnerId ? bodyOwnerId : req.user?.userId;

    const property = await Property.create({
      propertyName,
      address,
      description,
      images: images || ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'],
      totalRooms,
      owner: ownerId
    });

    // Create default rooms
    const createdRooms = [];
    const capacity = roomType === 'flat' ? 4 : 2;
    for (let i = 1; i <= totalRooms; i++) {
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
      throw new AppError('Unauthorized access to this property', 403);
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
      throw new AppError('Unauthorized update attempt', 403);
    }

    property.propertyName = propertyName || property.propertyName;
    property.address = address || property.address;
    property.description = description || property.description;
    property.images = images || property.images;
    if (totalRooms !== undefined) {
      property.totalRooms = totalRooms;
    }

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
      throw new AppError('Unauthorized delete attempt', 403);
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
    const { roomNumber, bedCapacity, monthlyRent, roomType = 'pg' } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId) {
      throw new AppError('Unauthorized', 403);
    }

    const actualCapacity = bedCapacity;

    const room = await Room.create({
      property: propertyId,
      roomNumber,
      roomType,
      bedCapacity: actualCapacity,
      occupancyStatus: 'vacant',
      monthlyRent
    });

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

    // Update total rooms count
    property.totalRooms = property.totalRooms + 1;
    await property.save();

    return res.status(201).json({ room, beds });
  } catch (error) {
    next(error);
  }
};

export const updateRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { roomNumber, bedCapacity, monthlyRent, agreementDocName, agreementDocData } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    // Validate ownership
    const property = await Property.findById(room.property);
    if (!property || (req.user?.role !== 'admin' && property.owner.toString() !== req.user?.userId)) {
      throw new AppError('Unauthorized', 403);
    }

    // Check unpaid person limits if uploading document
    if (agreementDocData !== undefined && req.user?.role !== 'admin' && property.owner) {
      await checkUnpaidPersonsLimit(property.owner.toString());
    }

    room.roomNumber = roomNumber || room.roomNumber;
    room.monthlyRent = monthlyRent !== undefined ? monthlyRent : room.monthlyRent;
    if (agreementDocName !== undefined) room.agreementDocName = agreementDocName;
    if (agreementDocData !== undefined) room.agreementDocData = agreementDocData;

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
          throw new AppError('Cannot reduce bed capacity below the number of currently occupied beds', 400);
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
      throw new AppError('Unauthorized', 403);
    }

    // Check if any beds are occupied
    const occupiedBeds = await Bed.find({ room: room._id, isOccupied: true });
    if (occupiedBeds.length > 0) {
      throw new AppError('Cannot delete a room that has active tenants', 400);
    }

    await Bed.deleteMany({ room: room._id });
    await Room.findByIdAndDelete(roomId);

    property.totalRooms = Math.max(0, property.totalRooms - 1);
    await property.save();

    return res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    next(error);
  }
};
