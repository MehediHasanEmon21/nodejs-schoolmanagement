import mongoose from 'mongoose';
import './AcademicYear.js';
import './SchoolClass.js';
import './Section.js';
import './Subject.js';
import './Teacher.js';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const timetableEntrySchema = new mongoose.Schema({
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  day: { type: String, enum: days, required: true },
  startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  room: { type: String, trim: true, maxlength: 80, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

timetableEntrySchema.index({ academicYear: 1, class: 1, section: 1, day: 1, startTime: 1 });
timetableEntrySchema.index({ academicYear: 1, teacher: 1, day: 1, startTime: 1 });

export const timetableDays = days;
export default mongoose.model('TimetableEntry', timetableEntrySchema);
