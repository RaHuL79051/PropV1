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
    agreementDocData: { type: String, default: '' }
  },
  { timestamps: true }
);

// Index to ensure unique room number per property
RoomSchema.index({ property: 1, roomNumber: 1 }, { unique: true });

export default mongoose.model<IRoom>('Room', RoomSchema);
