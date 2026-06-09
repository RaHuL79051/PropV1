import mongoose, { Schema, Document } from 'mongoose';

export interface ITenantInvite extends Document {
  owner: mongoose.Types.ObjectId;
  aadhaarNumber: string;
  panNumber?: string;
  email: string;
  tokenHash: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  assignedProperty: mongoose.Types.ObjectId | null;
  assignedRoom: mongoose.Types.ObjectId | null;
  assignedBed: mongoose.Types.ObjectId | null;
  joiningDate: Date | null;
  acceptedTenant: mongoose.Types.ObjectId | null;
}

const TenantInviteSchema: Schema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    aadhaarNumber: { type: String, required: true, trim: true },
    panNumber: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending'
    },
    expiresAt: { type: Date, required: true },
    assignedProperty: { type: Schema.Types.ObjectId, ref: 'Property', default: null },
    assignedRoom: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    assignedBed: { type: Schema.Types.ObjectId, ref: 'Bed', default: null },
    joiningDate: { type: Date, default: null },
    acceptedTenant: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null }
  },
  { timestamps: true }
);

TenantInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ITenantInvite>('TenantInvite', TenantInviteSchema);