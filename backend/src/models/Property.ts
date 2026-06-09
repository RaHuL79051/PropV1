import mongoose, { Schema, Document } from 'mongoose';

export interface IPropertyAddress {
  pincode: string;
  flatNo: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
}

export interface IProperty extends Document {
  propertyName: string;
  address: IPropertyAddress;
  description: string;
  images: string[];
  totalRooms: number;
  owner: mongoose.Types.ObjectId;
  fullAddress: string;
}

const PropertyAddressSchema = new Schema(
  {
    pincode: { type: String, default: '' },
    flatNo: { type: String, default: '' },
    area: { type: String, default: '' },
    landmark: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' }
  },
  { _id: false }
);

const PropertySchema: Schema = new Schema(
  {
    propertyName: { type: String, required: true, trim: true },
    address: { type: PropertyAddressSchema, required: true },
    description: { type: String, default: '' },
    images: [{ type: String }],
    totalRooms: { type: Number, required: false, default: 0, min: 0 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual that concatenates address fields into a display string
PropertySchema.virtual('fullAddress').get(function (this: any) {
  const addr = this.address;
  if (!addr || typeof addr === 'string') return addr || '';
  const parts = [
    addr.flatNo,
    addr.area,
    addr.landmark,
    addr.city,
    addr.state,
    addr.pincode
  ].filter((p: string) => p && p.trim());
  return parts.join(', ');
});

export default mongoose.model<IProperty>('Property', PropertySchema);
