import mongoose from 'mongoose';
import './SchoolClass.js';

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

sectionSchema.index({ class: 1, name: 1 }, { unique: true });
sectionSchema.index({ status: 1, class: 1, name: 1 });

export default mongoose.model('Section', sectionSchema);
