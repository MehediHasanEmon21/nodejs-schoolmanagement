import mongoose from 'mongoose';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import AuthorizationMigration from '../models/AuthorizationMigration.js';
import { defaultPermissions, defaultRoles } from '../config/authorization.js';

const rolePermissionMigrations = [
  {
    _id: 'phase7-academic-year-admin-permissions',
    description: 'Grant existing Admin roles access to the Academic Year module.',
    role: 'admin',
    permissions: ['academic_year.view', 'academic_year.create', 'academic_year.edit'],
  },
  {
    _id: 'phase8-academic-structure-admin-permissions',
    description: 'Grant existing Admin roles access to classes, sections and subjects.',
    role: 'admin',
    permissions: ['academic_structure.view', 'academic_structure.create', 'academic_structure.edit'],
  },
  {
    _id: 'phase10-teacher-admin-permissions',
    description: 'Grant existing Admin roles access to create and edit teachers.',
    role: 'admin',
    permissions: ['teacher.create', 'teacher.edit'],
  },
  {
    _id: 'phase11-guardian-permissions',
    description: 'Grant guardian management permissions to existing Admin and Guardian roles.',
    role: 'admin',
    permissions: ['guardian.view', 'guardian.create', 'guardian.edit'],
  },
  {
    _id: 'phase11-guardian-self-view-permission',
    description: 'Grant existing Guardian roles access to their own guardian profile.',
    role: 'guardian',
    permissions: ['guardian.view'],
  },
  {
    _id: 'phase12-enrollment-admin-permissions',
    description: 'Grant existing Admin roles access to student enrollments.',
    role: 'admin',
    permissions: ['enrollment.view', 'enrollment.create', 'enrollment.edit'],
  },
  {
    _id: 'phase12-enrollment-teacher-view-permission',
    description: 'Grant existing Teacher roles access to view enrollments.',
    role: 'teacher',
    permissions: ['enrollment.view'],
  },
  {
    _id: 'phase12-enrollment-student-view-permission',
    description: 'Grant existing Student roles access to their own enrollments.',
    role: 'student',
    permissions: ['enrollment.view'],
  },
  {
    _id: 'phase12-enrollment-guardian-view-permission',
    description: 'Grant existing Guardian roles access to linked student enrollments.',
    role: 'guardian',
    permissions: ['enrollment.view'],
  },
  {
    _id: 'phase13-teacher-assignment-admin-permissions',
    description: 'Grant existing Admin roles access to teacher assignments.',
    role: 'admin',
    permissions: ['teacher_assignment.view', 'teacher_assignment.create', 'teacher_assignment.edit'],
  },
  {
    _id: 'phase13-teacher-assignment-teacher-view-permission',
    description: 'Grant existing Teacher roles access to their own teacher assignments.',
    role: 'teacher',
    permissions: ['teacher_assignment.view'],
  },
  {
    _id: 'phase14-attendance-admin-permissions',
    description: 'Grant existing Admin roles access to attendance management.',
    role: 'admin',
    permissions: ['attendance.view', 'attendance.create', 'attendance.edit'],
  },
  {
    _id: 'phase14-attendance-teacher-permissions',
    description: 'Grant existing Teacher roles access to assigned attendance management.',
    role: 'teacher',
    permissions: ['attendance.view', 'attendance.create', 'attendance.edit'],
  },
  {
    _id: 'phase14-attendance-student-view-permission',
    description: 'Grant existing Student roles access to their own attendance history.',
    role: 'student',
    permissions: ['attendance.view'],
  },
  {
    _id: 'phase14-attendance-guardian-view-permission',
    description: 'Grant existing Guardian roles access to linked student attendance history.',
    role: 'guardian',
    permissions: ['attendance.view'],
  },
  {
    _id: 'phase15-exam-admin-permissions',
    description: 'Grant existing Admin roles access to exam management.',
    role: 'admin',
    permissions: ['exam.view', 'exam.create', 'exam.edit'],
  },
  {
    _id: 'phase15-exam-teacher-view-permission',
    description: 'Grant existing Teacher roles access to exam definitions.',
    role: 'teacher',
    permissions: ['exam.view'],
  },
  {
    _id: 'phase15-exam-student-view-permission',
    description: 'Grant existing Student roles access to exam definitions.',
    role: 'student',
    permissions: ['exam.view'],
  },
  {
    _id: 'phase15-exam-guardian-view-permission',
    description: 'Grant existing Guardian roles access to exam definitions.',
    role: 'guardian',
    permissions: ['exam.view'],
  },
  {
    _id: 'phase16-result-admin-permissions',
    description: 'Grant existing Admin roles access to marks and results.',
    role: 'admin',
    permissions: ['result.view', 'result.create', 'result.edit'],
  },
  {
    _id: 'phase16-result-teacher-edit-permission',
    description: 'Grant existing Teacher roles access to edit assigned marks.',
    role: 'teacher',
    permissions: ['result.edit'],
  },
  {
    _id: 'phase17-fee-admin-permissions',
    description: 'Grant existing Admin roles access to fee management.',
    role: 'admin',
    permissions: ['fee.view', 'fee.create', 'fee.edit'],
  },
  {
    _id: 'phase18-payment-admin-permissions',
    description: 'Grant existing Admin roles access to payment management.',
    role: 'admin',
    permissions: ['payment.view', 'payment.create'],
  },
  {
    _id: 'phase18-payment-student-view-permission',
    description: 'Grant existing Student roles access to their own payment history.',
    role: 'student',
    permissions: ['payment.view'],
  },
  {
    _id: 'phase18-payment-guardian-view-permission',
    description: 'Grant existing Guardian roles access to linked student payment history.',
    role: 'guardian',
    permissions: ['payment.view'],
  },
  {
    _id: 'phase19-timetable-admin-permissions',
    description: 'Grant existing Admin roles access to timetable management.',
    role: 'admin',
    permissions: ['timetable.view', 'timetable.create', 'timetable.edit'],
  },
  {
    _id: 'phase19-timetable-teacher-view-permission',
    description: 'Grant existing Teacher roles access to their own timetable.',
    role: 'teacher',
    permissions: ['timetable.view'],
  },
  {
    _id: 'phase19-timetable-student-view-permission',
    description: 'Grant existing Student roles access to their class timetable.',
    role: 'student',
    permissions: ['timetable.view'],
  },
  {
    _id: 'phase19-timetable-guardian-view-permission',
    description: 'Grant existing Guardian roles access to linked student timetables.',
    role: 'guardian',
    permissions: ['timetable.view'],
  },
  {
    _id: 'phase20-notice-admin-permissions',
    description: 'Grant existing Admin roles access to notice management.',
    role: 'admin',
    permissions: ['notice.view', 'notice.create', 'notice.edit'],
  },
  {
    _id: 'phase20-notice-teacher-view-permission',
    description: 'Grant existing Teacher roles access to notices.',
    role: 'teacher',
    permissions: ['notice.view'],
  },
  {
    _id: 'phase20-notice-student-view-permission',
    description: 'Grant existing Student roles access to notices.',
    role: 'student',
    permissions: ['notice.view'],
  },
  {
    _id: 'phase20-notice-guardian-view-permission',
    description: 'Grant existing Guardian roles access to notices.',
    role: 'guardian',
    permissions: ['notice.view'],
  },
  {
    _id: 'phase21-report-admin-permission',
    description: 'Grant existing Admin roles access to operational reports.',
    role: 'admin',
    permissions: ['report.view'],
  },
];

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
  for (const migration of rolePermissionMigrations) {
    if (await AuthorizationMigration.exists({ _id: migration._id })) continue;
    await Role.updateOne({ _id: migration.role }, { $addToSet: { permissions: { $each: migration.permissions } } }, { runValidators: true });
    await AuthorizationMigration.create({ _id: migration._id, description: migration.description });
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
