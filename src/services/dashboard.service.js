import { hasPermission, hasRole } from './authorization.service.js';

const modules = [
  { id: 'students', label: 'Students', permission: 'student.view', icon: 'people' },
  { id: 'teachers', label: 'Teachers', permission: 'teacher.view', icon: 'teaching' },
  { id: 'attendance', label: 'Attendance', permission: 'attendance.create', alternatePermission: 'attendance.edit', icon: 'calendar' },
  { id: 'results', label: 'Results', permission: 'result.view', icon: 'chart' },
  { id: 'fees', label: 'Fees', permission: 'fee.view', icon: 'wallet' },
];

export function getNavigation(authorization) {
  if (!hasPermission(authorization, 'dashboard.view')) return [];
  return [
    { id: 'dashboard', label: 'Overview', href: '/dashboard', icon: 'grid' },
    ...modules.filter((item) => hasPermission(authorization, item.permission) ||
      (item.alternatePermission && hasPermission(authorization, item.alternatePermission)))
      .map(({ id, label, icon }) => ({ id, label, icon, href: null })),
  ];
}

export function getDashboard(authorization) {
  const navigation = getNavigation(authorization);
  const permitted = new Set(navigation.map((item) => item.id));
  const administrator = hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
  const teacher = hasRole(authorization, 'teacher');
  const cards = [];
  if (permitted.has('students')) cards.push({ label: administrator ? 'Total students' : teacher ? 'Assigned students' : 'Student records', icon: 'people' });
  if (permitted.has('teachers')) cards.push({ label: administrator ? 'Total teachers' : 'Teaching team', icon: 'teaching' });
  if (navigation.length && (administrator || teacher)) cards.push({ label: administrator ? 'Total classes' : 'Assigned classes', icon: 'book' });
  if (permitted.has('attendance')) cards.push({ label: 'Today’s attendance', icon: 'calendar' });
  if (permitted.has('fees')) cards.push({ label: 'Outstanding fees', icon: 'wallet' });
  // Future modules must supply scoped data; a dash is unavailable data, never a zero count.
  return { cards, modules: navigation.filter((item) => !item.href) };
}
