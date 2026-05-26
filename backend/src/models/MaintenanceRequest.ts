import mongoose, { Schema, Document } from 'mongoose';

export interface IMaintenanceRequest extends Document {
  property: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  tenant: mongoose.Types.ObjectId;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'resolved';
  images: string[];
}

const MaintenanceRequestSchema: Schema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved'],
      default: 'pending'
    },
    images: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model<IMaintenanceRequest>('MaintenanceRequest', MaintenanceRequestSchema);
