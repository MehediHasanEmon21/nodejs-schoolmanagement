import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Notice from '../src/models/Notice.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { noticeFormValues, noticeListParams, validateNotice } from '../src/validators/notice.validator.js';

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

test('notice permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['notice.view', 'notice.create', 'notice.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('notice.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('notice.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('notice.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'guardian').permissions.includes('notice.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/notices'));
  assert.ok(getNavigation(authorization('student')).some((item) => item.href === '/notices'));
});

test('notice validator normalizes values and enforces targeted audience fields', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const valid = validateNotice({
    title: '  Assembly  ', body: '  Meet at hall  ', audience: 'section', class: oid, section: oid,
    status: 'published', visibleFrom: '2026-01-01', visibleUntil: '2026-01-31',
  });
  assert.equal(valid.data.title, 'Assembly');
  assert.equal(valid.data.status, 'published');
  assert.equal(valid.data.visibleFrom.toISOString().slice(0, 10), '2026-01-01');
  assert.deepEqual(valid.errors, {});
  const invalid = validateNotice({ title: '', body: '', audience: 'section', class: 'bad', section: '', visibleFrom: 'bad', visibleUntil: '2025-01-01' });
  assert.deepEqual(Object.keys(invalid.errors), ['title', 'body', 'class', 'section', 'visibleFrom']);
  const reversed = validateNotice({ title: 'A', body: 'B', visibleFrom: '2026-02-01', visibleUntil: '2026-01-01' });
  assert.equal(reversed.errors.visibleUntil, 'End date must be on or after the start date.');
});

test('notice model accepts valid records and list params are constrained', async () => {
  const notice = new Notice({ title: 'Notice', body: 'Details', audience: 'everyone', status: 'published' });
  await notice.validate();
  assert.deepEqual(noticeListParams({ page: '-1', audience: 'bad', status: 'bad' }), {
    page: 1, limit: 10, q: '', audience: '', status: '',
  });
  assert.equal(noticeListParams({ page: '3', audience: 'teachers', status: 'draft' }).page, 3);
});

test('notice views escape content and show management controls', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const notice = {
    _id: id, id, title: '<script>Assembly</script>', body: '<script>Meet</script>', audience: 'class', status: 'published',
    visibleFrom: new Date('2026-01-01'), visibleUntil: null,
    class: { _id: id, name: '<script>Grade 8</script>' }, section: null,
  };
  const locals = {
    title: 'Notices', activePage: 'notices', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: [], csrfToken: 'test-csrf-token',
  };
  const formOptions = { classes: [notice.class], sections: [{ _id: id, name: 'A', class: notice.class }] };
  const index = await render('notices/index', {
    ...locals, records: [notice],
    filters: { page: 1, q: '<script>', audience: '', status: '' },
    totalPages: 1, previousUrl: null, nextUrl: null, canManage: true, message: null,
  });
  assert.ok(!index.includes('<script>Assembly'));
  assert.match(index, /New notice/);
  const form = await render('notices/form', {
    ...locals, title: 'Edit notice', notice, values: noticeFormValues(notice), errors: {}, message: null, formOptions,
  });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.match(form, /Audience/);
  const show = await render('notices/show', { ...locals, title: 'Notice', notice, canManage: true, message: null });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Visible from/);
});
