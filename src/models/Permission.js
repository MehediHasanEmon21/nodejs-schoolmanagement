import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, required: true, match: /^[a-z][a-z_]*\.[a-z][a-z_]*$/, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

export default mongoose.model('Permission', schema);
