export const roleNames = ['super_admin', 'admin', 'teacher', 'student', 'guardian'];

export const defaultPermissions = [
  ['dashboard.view', 'View the dashboard'],
  ['student.view', 'View students within the permitted scope'],
  ['student.create', 'Create students'],
  ['student.edit', 'Edit students within the permitted scope'],
  ['student.delete', 'Delete students within the permitted scope'],
  ['teacher.view', 'View teachers within the permitted scope'],
  ['attendance.create', 'Record attendance within the permitted scope'],
  ['attendance.edit', 'Edit attendance within the permitted scope'],
  ['result.view', 'View published results within the permitted scope'],
  ['result.create', 'Record results within the permitted scope'],
  ['fee.view', 'View fees within the permitted scope'],
];

export const defaultRoles = [
  { _id: 'super_admin', name: 'Super Admin', permissions: [] },
  { _id: 'admin', name: 'Admin', permissions: defaultPermissions.map(([name]) => name) },
  { _id: 'teacher', name: 'Teacher', permissions: [
    'dashboard.view', 'student.view', 'teacher.view', 'attendance.create', 'attendance.edit', 'result.view', 'result.create',
  ] },
  { _id: 'student', name: 'Student', permissions: ['dashboard.view', 'student.view', 'result.view', 'fee.view'] },
  { _id: 'guardian', name: 'Guardian', permissions: ['dashboard.view', 'student.view', 'result.view', 'fee.view'] },
];
