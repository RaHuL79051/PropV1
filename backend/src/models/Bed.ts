import mongoose, { Schema, Document } from 'mongoose';

export interface IBed extends Document {
  room: mongoose.Types.ObjectId;
  bedNumber: string;
  tenant: mongoose.Types.ObjectId | null;
  isOccupied: boolean;
}

const BedSchema: Schema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    bedNumber: { type: String, required: true, trim: true },
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    isOccupied: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IBed>('Bed', BedSchema);
