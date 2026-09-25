import mongoose from 'mongoose';
import './AcademicYear.js';
import './FeeType.js';
import './Student.js';
import './User.js';

const studentFeeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  feeType: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeType', required: true },
  amount: { type: Number, required: true, min: 0, max: 10000000 },
  paidAmount: { type: Number, required: true, min: 0, max: 10000000, default: 0 },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'waived', 'cancelled'], default: 'pending', required: true },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

studentFeeSchema.index({ student: 1, academicYear: 1, feeType: 1, dueDate: 1 }, { unique: true });
studentFeeSchema.index({ student: 1, status: 1, dueDate: 1 });
studentFeeSchema.index({ academicYear: 1, feeType: 1, status: 1 });
studentFeeSchema.index({ dueDate: 1, status: 1 });

studentFeeSchema.pre('validate', function () {
  if (Number(this.paidAmount) > Number(this.amount)) {
    this.invalidate('paidAmount', 'Paid amount cannot exceed fee amount.');
  }
});

export default mongoose.model('StudentFee', studentFeeSchema);
