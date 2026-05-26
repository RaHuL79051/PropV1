import mongoose, { Schema, Document } from 'mongoose';

export interface IAgreement extends Document {
  tenant: mongoose.Types.ObjectId;
  property: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  termsAndConditions: string;
  additionalTerms: string;
  documentUrl: string;
  status: 'pending' | 'active' | 'expired';
  createdAt?: Date;
  updatedAt?: Date;
}

const AgreementSchema: Schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    monthlyRent: { type: Number, required: true, min: 0 },
    securityDeposit: { type: Number, required: true, min: 0 },
    termsAndConditions: { type: String, default: '' },
    additionalTerms: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

export default mongoose.model<IAgreement>('Agreement', AgreementSchema);
