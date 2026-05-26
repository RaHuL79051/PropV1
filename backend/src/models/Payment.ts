import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  tenant: mongoose.Types.ObjectId;
  property: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  amount: number;
  dueDate: Date;
  paymentDate: Date | null;
  status: 'paid' | 'unpaid' | 'overdue';
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'none';
  transactionId: string | null;
  notes?: string | null;
}

const PaymentSchema: Schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    paymentDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['paid', 'unpaid', 'overdue'],
      default: 'unpaid'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'bank_transfer', 'none'],
      default: 'none'
    },
    transactionId: { type: String, default: null },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model<IPayment>('Payment', PaymentSchema);
