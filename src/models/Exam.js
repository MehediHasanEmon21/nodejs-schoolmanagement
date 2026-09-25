import mongoose from 'mongoose';
import './AcademicYear.js';
import './SchoolClass.js';
import './Subject.js';

const examSubjectSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  totalMarks: { type: Number, required: true, min: 1, max: 1000 },
  passMarks: { type: Number, required: true, min: 0, max: 1000 },
  examDate: { type: Date, default: null },
}, { _id: false });

const examSchema = new mongoose.Schema({
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  subjects: { type: [examSubjectSchema], default: [] },
  status: { type: String, enum: ['draft', 'scheduled', 'completed', 'cancelled'], default: 'draft', required: true },
}, { timestamps: true });

examSchema.index({ academicYear: 1, class: 1, name: 1 }, { unique: true });
examSchema.index({ academicYear: 1, class: 1, startDate: 1 });
examSchema.index({ status: 1, startDate: -1 });

examSchema.path('subjects').validate((values) => new Set(values.map((item) => String(item.subject))).size === values.length, 'Subject setup must be unique.');

examSchema.pre('validate', function () {
  if (this.startDate instanceof Date && this.endDate instanceof Date && this.startDate > this.endDate) {
    this.invalidate('endDate', 'End date must be on or after the start date.');
  }
  for (const item of this.subjects ?? []) {
    if (Number(item.passMarks) > Number(item.totalMarks)) {
      this.invalidate('subjects', 'Pass marks cannot be greater than total marks.');
    }
    if (item.examDate instanceof Date && this.startDate instanceof Date && this.endDate instanceof Date &&
      (item.examDate < this.startDate || item.examDate > this.endDate)) {
      this.invalidate('subjects', 'Subject exam dates must be inside the exam date range.');
    }
  }
});

export default mongoose.model('Exam', examSchema);
