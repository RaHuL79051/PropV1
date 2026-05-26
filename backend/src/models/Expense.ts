import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  owner: mongoose.Types.ObjectId;
  date: Date;
  category: 'Food' | 'Travel' | 'Utilities/Bill' | 'Maintenance' | 'Salary' | 'Taxes' | 'Insurance' | 'Marketing' | 'Office' | 'Miscellaneous' | 'Other';
  amount: number;
  description: string;
}

const ExpenseSchema: Schema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Food', 'Travel', 'Utilities/Bill', 'Maintenance', 'Salary', 'Taxes', 'Insurance', 'Marketing', 'Office', 'Miscellaneous', 'Other']
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
