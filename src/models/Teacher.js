import mongoose from 'mongoose';
import './User.js';

const teacherSchema = new mongoose.Schema({
  teacherId: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, unique: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  joiningDate: { type: Date, required: true },
  qualification: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

teacherSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
teacherSchema.index({ name: 'text', teacherId: 'text', email: 'text', phone: 'text', qualification: 'text' });
teacherSchema.index({ status: 1, name: 1 });
teacherSchema.index({ joiningDate: -1 });

export default mongoose.model('Teacher', teacherSchema);
