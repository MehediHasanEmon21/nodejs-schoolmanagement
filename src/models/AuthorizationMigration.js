import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 200 },
}, { timestamps: true });

export default mongoose.model('AuthorizationMigration', schema);
