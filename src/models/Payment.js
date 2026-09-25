import mongoose from 'mongoose';
import './StudentFee.js';
import './User.js';

const paymentSchema = new mongoose.Schema({
  studentFee: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentFee', required: true },
  amount: { type: Number, required: true, min: 0.01, max: 10000000 },
  paidAt: { type: Date, required: true },
  method: { type: String, enum: ['cash', 'bank_transfer', 'card', 'mobile_banking', 'other'], default: 'cash', required: true },
  referenceNumber: { type: String, trim: true, uppercase: true, maxlength: 80, default: '' },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

paymentSchema.index({ studentFee: 1, paidAt: -1 });
paymentSchema.index({ referenceNumber: 1 }, { unique: true, partialFilterExpression: { referenceNumber: { $gt: '' } } });

export default mongoose.model('Payment', paymentSchema);
