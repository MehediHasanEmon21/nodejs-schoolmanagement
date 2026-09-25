import mongoose from 'mongoose';
import './AcademicYear.js';
import './SchoolClass.js';
import './Section.js';
import './Subject.js';
import './Teacher.js';

const teacherAssignmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

teacherAssignmentSchema.index(
  { teacher: 1, academicYear: 1, class: 1, section: 1, subject: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
teacherAssignmentSchema.index({ academicYear: 1, class: 1, section: 1, subject: 1, status: 1 });

export default mongoose.model('TeacherAssignment', teacherAssignmentSchema);
