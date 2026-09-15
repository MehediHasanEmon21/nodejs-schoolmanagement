import mongoose from 'mongoose';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import { defaultPermissions, defaultRoles } from '../config/authorization.js';

export async function seedAuthorization() {
  await Promise.all([Role.init(), Permission.init()]);
  const timestamps = { createdAt: new Date(), updatedAt: new Date() };
  // Insert only: restarts must never restore a deliberately revoked grant or disabled role.
  for (const [name, description] of defaultPermissions) {
    await Permission.updateOne({ _id: name }, { $setOnInsert: { description, status: 'active', ...timestamps } },
      { upsert: true, runValidators: true, timestamps: false });
  }
  for (const role of defaultRoles) {
    await Role.updateOne({ _id: role._id }, { $setOnInsert: { name: role.name, permissions: role.permissions, status: 'active', ...timestamps } },
      { upsert: true, runValidators: true, timestamps: false });
  }
}

export async function resolveAuthorization(user) {
  if (!user || user.status !== 'active') return null;
  const role = await Role.findById(user.role).populate({ path: 'permissions', match: { status: 'active' } });
  if (!role || role.status !== 'active') return null;
  const context = { user, role, permissions: new Set(role.permissions.map((permission) => permission.id)) };
  // Super Admin bypasses role grants, but never grants an unknown or disabled permission.
  if (isSuperAdmin(context)) {
    const permissions = await Permission.find({ status: 'active' }).select('_id');
    context.permissions = new Set(permissions.map((permission) => permission.id));
  }
  return context;
}

function isEligible(context) {
  return Boolean(context?.user?.id && context.user.status === 'active' &&
    context.role?.status === 'active' && context.user.role === context.role.id);
}

export function isSuperAdmin(context) {
  return isEligible(context) && context.role.id === 'super_admin';
}

export function hasRole(context, role) {
  // Role checks are exact. Include 'super_admin' explicitly when that role should be allowed.
  return isEligible(context) && context.role.id === role;
}

export function hasPermission(context, permission) {
  return isEligible(context) && typeof permission === 'string' && context.permissions instanceof Set && context.permissions.has(permission);
}

export function ownsResource({ user, resource }) {
  const owner = resource?.user?._id ?? resource?.user;
  return Boolean(user?.status === 'active' && mongoose.isObjectIdOrHexString(user.id) &&
    mongoose.isObjectIdOrHexString(owner) && String(owner) === String(user.id));
}

export async function canAccessResource(context, permission, resource, policy, { allowSuperAdmin = false } = {}) {
  if (!hasPermission(context, permission) || !resource || typeof policy !== 'function') return false;
  if (allowSuperAdmin === true && isSuperAdmin(context)) return true;
  return await policy({ user: context.user, resource, authorization: context }) === true;
}
