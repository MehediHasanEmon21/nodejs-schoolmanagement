import mongoose from 'mongoose';
import { roleNames } from '../config/authorization.js';
import './Permission.js';

const schema = new mongoose.Schema({
  // Stable string IDs preserve existing Phase 4 user.role values without a data migration.
  _id: { type: String, enum: roleNames, required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  permissions: [{ type: String, ref: 'Permission' }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true });

schema.path('permissions').validate((values) => new Set(values).size === values.length, 'Permissions must be unique.');

export default mongoose.model('Role', schema);
