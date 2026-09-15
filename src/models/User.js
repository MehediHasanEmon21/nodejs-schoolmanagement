import mongoose from 'mongoose';
import { hashPassword } from '../utils/password.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, unique: true },
  password: { type: String, required: true, select: false, minlength: 12, maxlength: 128 },
  role: { type: String, enum: ['super_admin', 'admin', 'teacher', 'student', 'guardian'], default: 'student', required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { transform(document, value) { delete value.password; return value; } } });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await hashPassword(this.password);
});
// Password writes must use document.save() so hashing cannot be bypassed by query updates.
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace']) {
  userSchema.pre(operation, function () {
    const update = this.getUpdate();
    if (Array.isArray(update) || operation.includes('Replace') || operation === 'replaceOne' ||
        Object.keys(update ?? {}).some((key) => key === 'password' || key.startsWith('password.') ||
          (key.startsWith('$') && Object.entries(update[key] ?? {}).some(([field, value]) =>
            field === 'password' || field.startsWith('password.') || (key === '$rename' && value === 'password'))))) {
      throw new Error('Use document.save() for password changes.');
    }
  });
}
userSchema.pre('insertMany', function () { throw new Error('Use document.save() to create users.'); });
userSchema.pre('bulkWrite', function () { throw new Error('Use document.save() to create or change users.'); });
export default mongoose.model('User', userSchema);
