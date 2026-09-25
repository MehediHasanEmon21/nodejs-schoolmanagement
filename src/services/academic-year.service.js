import mongoose from 'mongoose';
import AcademicYear from '../models/AcademicYear.js';
import { formatDateInput } from '../validators/academic-year.validator.js';

export class AcademicYearFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'AcademicYearFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function mapDuplicate(error) {
  if (error?.code === 11000) {
    const field = error.keyPattern?.name ? 'name' : 'isCurrent';
    const message = field === 'name' ? 'An academic year with this name already exists.' : 'Only one academic year can be current.';
    throw new AcademicYearFormError(message, { [field]: message });
  }
  throw error;
}

export function academicYearFormValues(academicYear = {}) {
  return {
    name: academicYear.name ?? '',
    startDate: typeof academicYear.startDate === 'string' ? academicYear.startDate : formatDateInput(academicYear.startDate),
    endDate: typeof academicYear.endDate === 'string' ? academicYear.endDate : formatDateInput(academicYear.endDate),
    status: academicYear.status ?? 'active',
    isCurrent: Boolean(academicYear.isCurrent),
  };
}

export async function listAcademicYears() {
  return AcademicYear.find({}).sort({ startDate: -1, name: 1 }).lean();
}

export async function getAcademicYear(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return AcademicYear.findById(id);
}

export async function createAcademicYear(data) {
  try {
    const wantsCurrent = data.isCurrent;
    const academicYear = await AcademicYear.create({ ...data, isCurrent: false });
    return wantsCurrent ? await activateAcademicYear(academicYear) : academicYear;
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function updateAcademicYear(academicYear, data) {
  try {
    const wantsCurrent = data.isCurrent;
    academicYear.set(wantsCurrent ? { ...data, isCurrent: false } : data);
    const saved = await academicYear.save();
    return wantsCurrent ? await activateAcademicYear(saved) : saved;
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function activateAcademicYear(academicYear) {
  if (academicYear.status !== 'active') {
    throw new AcademicYearFormError('Only an active academic year can be current.', { isCurrent: 'Only an active academic year can be current.' });
  }
  try {
    await AcademicYear.updateMany({ _id: { $ne: academicYear._id }, isCurrent: true }, { $set: { isCurrent: false } });
    academicYear.isCurrent = true;
    return await academicYear.save();
  } catch (error) {
    mapDuplicate(error);
  }
}
