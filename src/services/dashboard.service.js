import { hasPermission, hasRole } from './authorization.service.js';

const modules = [
  { id: 'academic-years', label: 'Academic Years', permission: 'academic_year.view', icon: 'calendar', href: '/academic-years' },
  { id: 'classes', label: 'Classes', permission: 'academic_structure.view', icon: 'book', href: '/classes' },
  { id: 'sections', label: 'Sections', permission: 'academic_structure.view', icon: 'grid', href: '/sections' },
  { id: 'subjects', label: 'Subjects', permission: 'academic_structure.view', icon: 'book', href: '/subjects' },
  { id: 'students', label: 'Students', permission: 'student.view', icon: 'people', href: '/students' },
  { id: 'teachers', label: 'Teachers', permission: 'teacher.view', icon: 'teaching', href: '/teachers' },
  { id: 'guardians', label: 'Guardians', permission: 'guardian.view', icon: 'people', href: '/guardians' },
  { id: 'enrollments', label: 'Enrollments', permission: 'enrollment.view', icon: 'book', href: '/enrollments' },
  { id: 'teacher-assignments', label: 'Teacher Assignments', permission: 'teacher_assignment.view', icon: 'teaching', href: '/teacher-assignments' },
  { id: 'attendance', label: 'Attendance', permission: 'attendance.view', alternatePermission: 'attendance.edit', icon: 'calendar', href: '/attendance' },
  { id: 'exams', label: 'Exams', permission: 'exam.view', icon: 'book', href: '/exams' },
  { id: 'results', label: 'Results', permission: 'result.view', icon: 'chart', href: '/results' },
  { id: 'fees', label: 'Fees', permission: 'fee.view', icon: 'wallet', href: '/fees' },
  { id: 'timetable', label: 'Timetable', permission: 'timetable.view', icon: 'calendar', href: '/timetable' },
  { id: 'notices', label: 'Notices', permission: 'notice.view', icon: 'book', href: '/notices' },
  { id: 'reports', label: 'Reports', permission: 'report.view', icon: 'chart', href: '/reports' },
];

export function getNavigation(authorization) {
  if (!hasPermission(authorization, 'dashboard.view')) return [];
  return [
    { id: 'dashboard', label: 'Overview', href: '/dashboard', icon: 'grid' },
    ...modules.filter((item) => hasPermission(authorization, item.permission) ||
      (item.alternatePermission && hasPermission(authorization, item.alternatePermission)))
      .map(({ id, label, icon, href = null }) => ({ id, label, icon, href })),
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
  if (permitted.has('attendance') && (administrator || teacher)) cards.push({ label: 'Today’s attendance', icon: 'calendar' });
  if (permitted.has('fees')) cards.push({ label: 'Outstanding fees', icon: 'wallet' });
  // Future modules must supply scoped data; a dash is unavailable data, never a zero count.
  return { cards, modules: navigation.filter((item) => !item.href) };
}
