import mongoose from 'mongoose';
import './SchoolClass.js';

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  code: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass' }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

subjectSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $gt: '' } } });
subjectSchema.index({ status: 1, name: 1 });
subjectSchema.path('classes').validate((values) => new Set(values.map(String)).size === values.length, 'Class assignments must be unique.');

export default mongoose.model('Subject', subjectSchema);
