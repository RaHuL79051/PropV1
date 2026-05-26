import mongoose, { Schema, Document } from 'mongoose';

export interface IProperty extends Document {
  propertyName: string;
  address: string;
  description: string;
  images: string[];
  totalRooms: number;
  owner: mongoose.Types.ObjectId;
}

const PropertySchema: Schema = new Schema(
  {
    propertyName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    images: [{ type: String }],
    totalRooms: { type: Number, required: false, default: 0, min: 0 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model<IProperty>('Property', PropertySchema);
