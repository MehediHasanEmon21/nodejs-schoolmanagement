import mongoose from 'mongoose';
import './SchoolClass.js';
import './Section.js';
import './User.js';

export const noticeAudiences = ['everyone', 'admins', 'teachers', 'students', 'guardians', 'class', 'section'];
export const noticeStatuses = ['draft', 'published'];

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  audience: { type: String, enum: noticeAudiences, default: 'everyone', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', default: null },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
  status: { type: String, enum: noticeStatuses, default: 'draft', required: true },
  visibleFrom: { type: Date, default: null },
  visibleUntil: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

noticeSchema.index({ status: 1, audience: 1, visibleFrom: -1, createdAt: -1 });
noticeSchema.index({ class: 1, section: 1, status: 1 });
noticeSchema.index({ status: 1, visibleUntil: 1 });
noticeSchema.index({ title: 'text', body: 'text' });

export default mongoose.model('Notice', noticeSchema);
