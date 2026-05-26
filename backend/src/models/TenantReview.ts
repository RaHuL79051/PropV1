import mongoose, { Schema, Document } from 'mongoose';

export interface ITenantReview extends Document {
  aadhaarNumber: string;
  tenantName: string;
  rating: number;
  feedback: string;
  owner: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TenantReviewSchema: Schema = new Schema(
  {
    aadhaarNumber: { type: String, required: true, trim: true, index: true },
    tenantName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model<ITenantReview>('TenantReview', TenantReviewSchema);
