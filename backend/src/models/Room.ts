import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  property: mongoose.Types.ObjectId;
  roomNumber: string;
  roomType: 'flat' | 'pg';
  bedCapacity: number;
  occupancyStatus: 'vacant' | 'partially_occupied' | 'fully_occupied';
  monthlyRent: number;
  agreementDocName?: string;
  agreementDocData?: string;
  // Room filters / checklist
  flatCategory?: string;
  propertyType?: string[];
  preferredTenant?: string[];
  furnishedType?: string;
}

const RoomSchema: Schema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    roomNumber: { type: String, required: true, trim: true },
    roomType: {
      type: String,
      enum: ['flat', 'pg'],
      default: 'pg'
    },
    bedCapacity: { type: Number, required: true, min: 1 },
    occupancyStatus: {
      type: String,
      enum: ['vacant', 'partially_occupied', 'fully_occupied'],
      default: 'vacant'
    },
    monthlyRent: { type: Number, required: true, min: 0 },
    agreementDocName: { type: String, default: '' },
    agreementDocData: { type: String, default: '' },
    // Room filters / checklist fields
    flatCategory: {
      type: String,
      enum: ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', ''],
      default: ''
    },
    propertyType: [{
      type: String,
      enum: ['Fully Independent', 'Owner Free', 'Living Couple', 'Student Allowed']
    }],
    preferredTenant: [{
      type: String,
      enum: ['All', 'Boys', 'Boys & Girls', 'Company', 'Family', 'Family & Boys', 'Family & Girls', 'Girls']
    }],
    furnishedType: {
      type: String,
      enum: ['Fully Furnished', 'Semi Furnished', 'Unfurnished', ''],
      default: ''
    }
  },
  { timestamps: true }
);

// Index to ensure unique room number per property
RoomSchema.index({ property: 1, roomNumber: 1 }, { unique: true });

export default mongoose.model<IRoom>('Room', RoomSchema);
