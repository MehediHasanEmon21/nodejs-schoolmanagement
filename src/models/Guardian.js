import mongoose from 'mongoose';
import './User.js';
import './Student.js';

const guardianSchema = new mongoose.Schema({
  guardianId: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, default: '' },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  relationship: { type: String, required: true, trim: true, maxlength: 80 },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

guardianSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
guardianSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $gt: '' } } });
guardianSchema.index({ name: 'text', guardianId: 'text', email: 'text', phone: 'text', relationship: 'text' });
guardianSchema.index({ status: 1, name: 1 });
guardianSchema.index({ students: 1, status: 1 });
guardianSchema.path('students').validate((values) => new Set(values.map(String)).size === values.length, 'Student links must be unique.');

export default mongoose.model('Guardian', guardianSchema);
