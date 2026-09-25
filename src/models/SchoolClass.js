import mongoose from 'mongoose';

const schoolClassSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

schoolClassSchema.index({ status: 1, name: 1 });

export default mongoose.model('SchoolClass', schoolClassSchema);
