import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Subject from '../src/models/Subject.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { classFormValues, sectionFormValues, subjectFormValues } from '../src/services/academic-structure.service.js';
import { validateSchoolClass, validateSection, validateSubject } from '../src/validators/academic-structure.validator.js';

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

function authorization(roleName = 'admin', permissions) {
  const role = defaultRoles.find((item) => item._id === roleName);
  return {
    user: { id: '000000000000000000000123', role: roleName, name: 'Ada', status: 'active' },
    role: { id: roleName, name: role.name, status: 'active' },
    permissions: new Set(permissions ?? role.permissions),
  };
}

test('academic structure permissions and navigation are admin-only', () => {
  for (const permission of ['academic_structure.view', 'academic_structure.create', 'academic_structure.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
    assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes(permission));
  }
  const adminLinks = getNavigation(authorization()).filter((item) => item.href).map((item) => item.href);
  for (const href of ['/classes', '/sections', '/subjects']) assert.ok(adminLinks.includes(href));
  assert.ok(!getNavigation(authorization('student')).some((item) => ['classes', 'sections', 'subjects'].includes(item.id)));
});

test('academic structure validators normalize values and reject malformed relationships', () => {
  assert.deepEqual(validateSchoolClass({ name: '  Grade   8 ', status: 'inactive' }).values, { name: 'Grade 8', status: 'inactive' });
  assert.equal(validateSchoolClass({ name: '' }).errors.name, 'Enter a class name up to 80 characters.');
  assert.equal(validateSection({ name: 'A', class: 'not-an-id' }).errors.class, 'Choose a valid class.');
  const id = new mongoose.Types.ObjectId().toString();
  const subject = validateSubject({ name: ' Science ', code: ' sci ', classes: [id, id], status: 'active' });
  assert.deepEqual(subject.values, { name: 'Science', code: 'SCI', classes: [id], status: 'active' });
  assert.equal(validateSubject({ name: 'Science' }).errors.classes, 'Choose at least one class for this subject.');
});

test('academic structure models enforce required fields and local uniqueness validators', async () => {
  await assert.rejects(new SchoolClass({ name: '', status: 'active' }).validate());
  await assert.rejects(new Section({ name: 'A', class: 'not-an-id' }).validate());
  const classId = new mongoose.Types.ObjectId();
  await new Section({ name: 'A', class: classId }).validate();
  await assert.rejects(new Subject({ name: 'Science', classes: [classId, classId] }).validate(), /Class assignments must be unique/);
  await new Subject({ name: 'Science', code: 'sci', classes: [classId] }).validate();
});

test('academic structure views escape content and preserve relationship fields', async () => {
  const classId = new mongoose.Types.ObjectId();
  const record = { _id: classId, id: String(classId), name: '<script>Grade 8</script>', status: 'active' };
  const locals = {
    title: 'Classes',
    activePage: 'classes',
    currentUser: { name: 'Ada' },
    currentRoleName: 'Admin',
    navigation: getNavigation(authorization()),
    csrfToken: 'test-csrf-token',
  };
  const classes = await render('academic-structure/classes', { ...locals, records: [record], message: '<script>' });
  assert.ok(!classes.includes('<script>'));
  assert.match(classes, /href="\/classes\//);
  const classForm = await render('academic-structure/class-form', {
    ...locals, title: 'Edit class', record, values: classFormValues(record), errors: {}, message: null,
  });
  assert.ok(!classForm.includes('<script>'));
  assert.match(classForm, /name="_csrf" value="test-csrf-token"/);
  const sectionForm = await render('academic-structure/section-form', {
    ...locals, title: 'New section', activePage: 'sections', record: null, values: sectionFormValues({ class: classId }), errors: {}, message: null, classes: [record],
  });
  assert.ok(!sectionForm.includes('<script>'));
  assert.match(sectionForm, /selected/);
  const subjectForm = await render('academic-structure/subject-form', {
    ...locals, title: 'New subject', activePage: 'subjects', record: null, values: subjectFormValues({ classes: [classId] }), errors: {}, message: null, classes: [record],
  });
  assert.ok(!subjectForm.includes('<script>'));
  assert.match(subjectForm, /checked/);
});
