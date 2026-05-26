import mongoose, { Schema, Document } from 'mongoose';

export interface ITenantOwnerConnection extends Document {
  tenant: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TenantOwnerConnectionSchema: Schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Index for fast lookups
TenantOwnerConnectionSchema.index({ tenant: 1, owner: 1 }, { unique: true });

export default mongoose.model<ITenantOwnerConnection>('TenantOwnerConnection', TenantOwnerConnectionSchema);
