import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  fullName: string;
  aadhaarNumber: string;
  email?: string;
  phone: string;
  emergencyContact: string;
  occupation: string;
  address: string;
  agreementStatus: 'pending' | 'active' | 'expired';
  verificationStatus: 'pending' | 'verified' | 'failed';
  tenantRating: number;
  creditScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  previousOwnerFeedback: string[];
  assignedProperty: mongoose.Types.ObjectId | null;
  assignedRoom: mongoose.Types.ObjectId | null;
  assignedBed: mongoose.Types.ObjectId | null;
  rentAmount: number | null;
  joiningDate: Date | null;
  owner: mongoose.Types.ObjectId;
  documents?: {
    aadhaarDocName?: string;
    aadhaarDocData?: string;
    agreementDocName?: string;
    agreementDocData?: string;
    photoDocName?: string;
    photoDocData?: string;
  };
  additionalCharges?: {
    _id: any;
    description: string;
    amount: number;
    createdAt?: Date;
  }[];
}

const TenantSchema: Schema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    aadhaarNumber: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, required: true, trim: true },
    emergencyContact: { type: String, default: '', trim: true },
    occupation: { type: String, default: '', trim: true },
    address: { type: String, required: true, trim: true },
    agreementStatus: {
      type: String,
      enum: ['pending', 'active', 'expired'],
      default: 'pending'
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending'
    },
    tenantRating: { type: Number, default: 5, min: 1, max: 5 },
    creditScore: { type: Number, default: 700, min: 300, max: 850 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    previousOwnerFeedback: [{ type: String }],
    documents: {
      aadhaarDocName: { type: String, default: '' },
      aadhaarDocData: { type: String, default: '' },
      agreementDocName: { type: String, default: '' },
      agreementDocData: { type: String, default: '' },
      photoDocName: { type: String, default: '' },
      photoDocData: { type: String, default: '' }
    },
    assignedProperty: { type: Schema.Types.ObjectId, ref: 'Property', default: null },
    assignedRoom: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    assignedBed: { type: Schema.Types.ObjectId, ref: 'Bed', default: null },
    rentAmount: { type: Number, default: null },
    joiningDate: { type: Date, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    additionalCharges: [
      {
        description: { type: String, required: true },
        amount: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model<ITenant>('Tenant', TenantSchema);
