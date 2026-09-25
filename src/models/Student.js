import mongoose from 'mongoose';
import './User.js';
import './SchoolClass.js';
import './Section.js';

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say'], required: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  admissionDate: { type: Date, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', default: null },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

studentSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
studentSchema.index({ firstName: 'text', lastName: 'text', studentId: 'text', phone: 'text' });
studentSchema.index({ status: 1, firstName: 1, lastName: 1 });
studentSchema.index({ class: 1, section: 1, status: 1 });
studentSchema.index({ admissionDate: -1 });

export default mongoose.model('Student', studentSchema);
