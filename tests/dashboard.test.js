import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import { getDashboard, getNavigation } from '../src/services/dashboard.service.js';
import { defaultRoles } from '../src/config/authorization.js';

function authorization(roleName, permissions) {
  const role = defaultRoles.find((item) => item._id === roleName);
  return {
    user: { id: '000000000000000000000123', role: roleName, name: '<script>Ada</script>', status: 'active' },
    role: { id: roleName, name: role.name, status: 'active' },
    permissions: new Set(permissions ?? role.permissions),
  };
}

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

test('navigation links only to implemented pages and hides unavailable permissions', () => {
  assert.deepEqual(getNavigation(null), []);
  assert.deepEqual(getNavigation(authorization('student', ['student.view'])), []);
  const student = getNavigation(authorization('student'));
  assert.ok(student.some((item) => item.id === 'students'));
  assert.ok(!student.some((item) => ['teachers', 'attendance'].includes(item.id)));
  assert.deepEqual(student.filter((item) => item.href).map((item) => item.href), ['/dashboard']);
  const teacher = authorization('teacher', ['dashboard.view', 'attendance.edit']);
  assert.ok(getNavigation(teacher).some((item) => item.id === 'attendance'));
  teacher.role.status = 'inactive';
  assert.deepEqual(getNavigation(teacher), []);
});

test('dashboard uses unavailable metrics and scopes labels for non-admin users', () => {
  const admin = getDashboard(authorization('admin'));
  assert.equal(admin.cards.length, 5);
  assert.ok(admin.cards.every((card) => card.value === undefined));
  const student = getDashboard(authorization('student'));
  assert.ok(!student.cards.some((card) => /Total|attendance|Teaching team/.test(card.label)));
  assert.ok(student.cards.some((card) => card.label === 'Student records'));
  assert.ok(getDashboard(authorization('teacher')).cards.some((card) => card.label === 'Assigned students'));
  assert.deepEqual(getDashboard(null), { cards: [], modules: [] });
});

test('dashboard renders escaped account data, accessible navigation and honest empty states', async () => {
  const context = authorization('admin');
  const html = await render('dashboard/index', {
    title: 'Dashboard', activePage: 'dashboard', currentUser: context.user, currentRoleName: context.role.name,
    navigation: getNavigation(context), dashboard: getDashboard(context), csrfToken: 'test-csrf-token',
  });
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.ok(!html.includes('<script>Ada'));
  assert.match(html, /&lt;script&gt;Ada/);
  assert.match(html, /aria-current="page"[^>]*>[\s\S]*?Overview/);
  for (const text of ['School overview', 'Your workspace', 'School updates', 'Not available yet', 'Coming soon']) assert.ok(html.includes(text));
  for (const path of ['/students', '/teachers', '/attendance', '/fees', '/results']) assert.ok(!html.includes(`href="${path}"`));
  assert.match(html, /data-confirm-dialog="logout-dialog"/);
  assert.match(html, /<dialog id="logout-dialog"/);
  assert.match(html, /aria-labelledby="logout-dialog-title"/);
  assert.match(html, /name="_csrf" value="test-csrf-token"/);
});

test('shared empty states and modal text are escaped; confirmation retains POST and CSRF', async () => {
  const attack = '<script>alert(1)</script>';
  const empty = await render('partials/empty-state', { heading: attack, description: attack });
  assert.ok(!empty.includes('<script>'));
  const modal = await render('partials/modal', {
    id: 'confirm', title: attack, description: attack, action: '/logout', confirmLabel: 'Log out', csrfToken: attack,
  });
  assert.ok(!modal.includes('<script>'));
  assert.match(modal, /method="post" action="\/logout"/);
  assert.match(modal, /method="dialog"/);
  assert.match(modal, /autofocus/);
  assert.ok(!modal.includes('<dialog open'));
});

test('metric cards distinguish unavailable values from real zero values', async () => {
  const missing = await render('partials/stat-card', { label: 'Students' });
  assert.match(missing, /Not available yet/);
  const zero = await render('partials/stat-card', { label: 'Students', value: 0 });
  assert.ok(!zero.includes('Not available yet'));
  assert.match(zero, />0<\/p>/);
  const escaped = await render('partials/stat-card', { label: '<script>', value: '<script>', caption: '<script>' });
  assert.ok(!escaped.includes('<script>'));
});
