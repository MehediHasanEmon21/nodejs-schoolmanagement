import mongoose from 'mongoose';
import './Enrollment.js';
import './Exam.js';
import './Student.js';
import './Subject.js';
import './User.js';

const markSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
  marksObtained: { type: Number, required: true, min: 0, max: 1000 },
  note: { type: String, trim: true, maxlength: 200, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

markSchema.index({ exam: 1, subject: 1, student: 1 }, { unique: true });
markSchema.index({ exam: 1, student: 1 });
markSchema.index({ exam: 1, subject: 1 });

export default mongoose.model('Mark', markSchema);
