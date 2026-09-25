import mongoose from 'mongoose';
import './AcademicYear.js';
import './SchoolClass.js';
import './Section.js';
import './Student.js';

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  rollNumber: { type: String, required: true, trim: true, maxlength: 40 },
  enrollmentDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'inactive', 'completed', 'transferred'], default: 'active', required: true },
}, { timestamps: true });

enrollmentSchema.index({ student: 1, academicYear: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
enrollmentSchema.index(
  { academicYear: 1, class: 1, section: 1, rollNumber: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
enrollmentSchema.index({ academicYear: 1, class: 1, section: 1, status: 1, rollNumber: 1 });
enrollmentSchema.index({ student: 1, status: 1, enrollmentDate: -1 });

export default mongoose.model('Enrollment', enrollmentSchema);
