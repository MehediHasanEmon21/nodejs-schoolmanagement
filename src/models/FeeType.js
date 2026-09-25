import mongoose from 'mongoose';

const feeTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  defaultAmount: { type: Number, required: true, min: 0, max: 10000000 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

feeTypeSchema.index({ status: 1, name: 1 });

export default mongoose.model('FeeType', feeTypeSchema);
