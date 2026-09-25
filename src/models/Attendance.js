import mongoose from 'mongoose';
import './AcademicYear.js';
import './Enrollment.js';
import './SchoolClass.js';
import './Section.js';
import './Student.js';
import './User.js';

const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
  note: { type: String, trim: true, maxlength: 200, default: '' },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  date: { type: Date, required: true },
  records: { type: [attendanceRecordSchema], default: [] },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

attendanceSchema.index({ academicYear: 1, class: 1, section: 1, date: 1 }, { unique: true });
attendanceSchema.index({ 'records.student': 1, date: -1 });
attendanceSchema.index({ academicYear: 1, class: 1, section: 1, date: -1 });

attendanceSchema.pre('validate', function () {
  if (this.date instanceof Date && !Number.isNaN(this.date.valueOf())) {
    this.date = new Date(Date.UTC(this.date.getUTCFullYear(), this.date.getUTCMonth(), this.date.getUTCDate()));
  }
});

export default mongoose.model('Attendance', attendanceSchema);
