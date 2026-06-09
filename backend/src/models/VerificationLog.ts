import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationLog extends Document {
  aadhaarNumber?: string;
  searchCriteria?: Record<string, any>;
  operator?: 'and' | 'or';
  requester: mongoose.Types.ObjectId;
  timestamp: Date;
  result: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'verified' | 'failed';
}

const VerificationLogSchema: Schema = new Schema(
  {
    aadhaarNumber: { type: String, default: '', trim: true },
    searchCriteria: { type: Object, default: {} },
    operator: { type: String, enum: ['and', 'or'], default: 'or' },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    result: { type: Object, required: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: { type: String, enum: ['verified', 'failed'], default: 'verified' }
  },
  { timestamps: true }
);

export default mongoose.model<IVerificationLog>('VerificationLog', VerificationLogSchema);
