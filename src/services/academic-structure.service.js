import mongoose from 'mongoose';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Subject from '../models/Subject.js';

export class AcademicStructureFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'AcademicStructureFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error, fallbackField = 'name') {
  if (error?.code !== 11000) throw error;
  const field = error.keyPattern?.code ? 'code' : fallbackField;
  const messages = {
    name: 'A record with this name already exists.',
    code: 'A subject with this code already exists.',
    class: 'This section already exists for the selected class.',
  };
  throw new AcademicStructureFormError(messages[field], { [field]: messages[field] });
}

export function classFormValues(record = {}) {
  return { name: record.name ?? '', status: record.status ?? 'active' };
}

export function sectionFormValues(record = {}) {
  return { name: record.name ?? '', class: String(record.class?._id ?? record.class ?? ''), status: record.status ?? 'active' };
}

export function subjectFormValues(record = {}) {
  return {
    name: record.name ?? '',
    code: record.code ?? '',
    classes: (record.classes ?? []).map((item) => String(item._id ?? item)),
    status: record.status ?? 'active',
  };
}

export async function listClasses() {
  return SchoolClass.find({}).sort({ name: 1 }).lean();
}

export async function listSections() {
  return Section.find({}).populate('class').sort({ name: 1 }).lean();
}

export async function listSubjects() {
  return Subject.find({}).populate('classes').sort({ name: 1 }).lean();
}

export async function getClass(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return SchoolClass.findById(id);
}

export async function getSection(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Section.findById(id).populate('class');
}

export async function getSubject(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Subject.findById(id).populate('classes');
}

export async function createClass(data) {
  try {
    return await SchoolClass.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateClass(record, data) {
  try {
    record.set(data);
    return await record.save();
  } catch (error) {
    duplicateError(error);
  }
}

async function ensureClass(id) {
  const record = await getClass(id);
  if (!record) throw new AcademicStructureFormError('Choose a valid class.', { class: 'Choose a valid class.' });
  return record;
}

async function ensureClasses(classIds) {
  const records = await SchoolClass.find({ _id: { $in: classIds } }).select('_id');
  if (records.length !== classIds.length) {
    throw new AcademicStructureFormError('Choose valid classes.', { classes: 'Choose valid classes.' });
  }
}

export async function createSection(data) {
  try {
    await ensureClass(data.class);
    return await Section.create(data);
  } catch (error) {
    duplicateError(error, 'class');
  }
}

export async function updateSection(record, data) {
  try {
    await ensureClass(data.class);
    record.set(data);
    return await record.save();
  } catch (error) {
    duplicateError(error, 'class');
  }
}

export async function createSubject(data) {
  try {
    await ensureClasses(data.classes);
    return await Subject.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateSubject(record, data) {
  try {
    await ensureClasses(data.classes);
    record.set(data);
    return await record.save();
  } catch (error) {
    duplicateError(error);
  }
}
