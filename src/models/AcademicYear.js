import mongoose from 'mongoose';

const academicYearSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

academicYearSchema.index({ isCurrent: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });
academicYearSchema.index({ status: 1, startDate: -1 });

academicYearSchema.pre('validate', function () {
  if (this.startDate instanceof Date && this.endDate instanceof Date && this.startDate >= this.endDate) {
    this.invalidate('endDate', 'End date must be after the start date.');
  }
  if (this.isCurrent && this.status !== 'active') {
    this.invalidate('isCurrent', 'Only an active academic year can be current.');
  }
});

export default mongoose.model('AcademicYear', academicYearSchema);
