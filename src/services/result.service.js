import mongoose from 'mongoose';
import Enrollment from '../models/Enrollment.js';
import Exam from '../models/Exam.js';
import Guardian from '../models/Guardian.js';
import Mark from '../models/Mark.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { hasRole } from './authorization.service.js';

export class ResultFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'ResultFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const message = 'Marks already exist for one or more selected students.';
  throw new ResultFormError(message, { marks: message });
}

export function canManageResults(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function teacherProfileId(userId) {
  const teacher = await Teacher.findOne({ user: userId, status: 'active' }).select('_id');
  return teacher?._id ?? null;
}

export async function canEnterMarks(authorization, exam, subjectId) {
  if (!exam || !subjectId) return false;
  if (canManageResults(authorization)) return true;
  if (!hasRole(authorization, 'teacher')) return false;
  const teacherId = await teacherProfileId(authorization.user.id);
  if (!teacherId) return false;
  return Boolean(await TeacherAssignment.exists({
    teacher: teacherId,
    academicYear: exam.academicYear?._id ?? exam.academicYear,
    class: exam.class?._id ?? exam.class,
    subject: subjectId,
    status: 'active',
  }));
}

export async function canViewStudentResult(authorization, studentId) {
  if (canManageResults(authorization) || hasRole(authorization, 'teacher')) return true;
  if (hasRole(authorization, 'student')) return Boolean(await Student.exists({ _id: studentId, user: authorization.user.id }));
  if (hasRole(authorization, 'guardian')) return Boolean(await Guardian.exists({ user: authorization.user.id, status: 'active', students: studentId }));
  return false;
}

export async function listResultFormOptions() {
  const exams = await Exam.find({ status: { $in: ['scheduled', 'completed'] } }).populate('academicYear class subjects.subject').sort({ startDate: -1 }).lean();
  return { exams };
}

export async function getExamForMarks(examId) {
  if (!mongoose.isObjectIdOrHexString(examId)) return null;
  return Exam.findById(examId).populate('academicYear class subjects.subject');
}

export function examSubjectConfig(exam, subjectId) {
  return (exam?.subjects ?? []).find((item) => String(item.subject?._id ?? item.subject) === String(subjectId)) ?? null;
}

export async function loadMarkRoster(data, authorization) {
  const exam = await getExamForMarks(data.exam);
  const subjectConfig = examSubjectConfig(exam, data.subject);
  if (!exam || !subjectConfig) throw new ResultFormError('Choose a valid exam subject.', { subject: 'Choose a subject configured for this exam.' });
  if (!await canEnterMarks(authorization, exam, data.subject)) return null;
  const enrollments = await Enrollment.find({
    academicYear: exam.academicYear._id,
    class: exam.class._id,
    status: 'active',
  }).populate('student').sort({ section: 1, rollNumber: 1 }).lean();
  const marks = await Mark.find({ exam: exam._id, subject: data.subject }).lean();
  const markMap = new Map(marks.map((mark) => [String(mark.student), mark]));
  return {
    exam,
    subjectConfig,
    roster: enrollments.filter((enrollment) => enrollment.student?.status === 'active')
      .map((enrollment) => ({ ...enrollment, mark: markMap.get(String(enrollment.student._id)) ?? null })),
  };
}

export function calculateSubjectResult(mark, subjectConfig) {
  const marksObtained = Number(mark?.marksObtained ?? 0);
  const totalMarks = Number(subjectConfig.totalMarks);
  const passMarks = Number(subjectConfig.passMarks);
  const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
  const passed = marksObtained >= passMarks;
  const grade = !passed ? 'F' : percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'E';
  return { marksObtained, totalMarks, passMarks, percentage, passed, grade };
}

export function calculateResult(rows) {
  const totals = rows.reduce((carry, row) => ({
    marksObtained: carry.marksObtained + row.result.marksObtained,
    totalMarks: carry.totalMarks + row.result.totalMarks,
    passMarks: carry.passMarks + row.result.passMarks,
    passed: carry.passed && row.result.passed,
  }), { marksObtained: 0, totalMarks: 0, passMarks: 0, passed: true });
  const percentage = totals.totalMarks > 0 ? (totals.marksObtained / totals.totalMarks) * 100 : 0;
  const grade = !totals.passed ? 'F' : percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'E';
  return { ...totals, percentage, grade };
}

export async function saveMarks(data, authorization) {
  try {
    const loaded = await loadMarkRoster(data, authorization);
    if (!loaded) throw Object.assign(new Error('Access denied'), { status: 403 });
    const { exam, subjectConfig, roster } = loaded;
    const operations = [];
    const errors = {};
    for (const enrollment of roster) {
      const studentId = String(enrollment.student._id);
      const value = data.marks[studentId];
      if (!value) continue;
      if (value.number < 0 || value.number > subjectConfig.totalMarks) {
        errors.marks = `Marks must be between 0 and ${subjectConfig.totalMarks}.`;
        continue;
      }
      operations.push({
        updateOne: {
          filter: { exam: exam._id, subject: data.subject, student: enrollment.student._id },
          update: {
            $set: {
              enrollment: enrollment._id,
              marksObtained: value.number,
              note: value.note,
              updatedBy: authorization.user.id,
            },
            $setOnInsert: { recordedBy: authorization.user.id },
          },
          upsert: true,
        },
      });
    }
    if (Object.keys(errors).length) throw new ResultFormError('Please check the entered marks.', errors);
    if (operations.length) await Mark.bulkWrite(operations, { ordered: false });
    return loaded;
  } catch (error) {
    duplicateError(error);
  }
}

export async function studentResult(examId, studentId, authorization) {
  if (!mongoose.isObjectIdOrHexString(examId) || !mongoose.isObjectIdOrHexString(studentId)) return null;
  const exam = await getExamForMarks(examId);
  const student = await Student.findById(studentId);
  if (!exam || !student || !await canViewStudentResult(authorization, student._id)) return null;
  const marks = await Mark.find({ exam: exam._id, student: student._id }).populate('subject').lean();
  const markMap = new Map(marks.map((mark) => [String(mark.subject._id), mark]));
  const rows = exam.subjects.map((config) => {
    const subject = config.subject;
    const mark = markMap.get(String(subject._id));
    return { subject, mark, result: calculateSubjectResult(mark, config) };
  });
  return { exam, student, rows, summary: calculateResult(rows) };
}

export async function classResult(examId, authorization) {
  if (!mongoose.isObjectIdOrHexString(examId)) return null;
  const exam = await getExamForMarks(examId);
  if (!exam || !(canManageResults(authorization) || hasRole(authorization, 'teacher'))) return null;
  const enrollments = await Enrollment.find({ academicYear: exam.academicYear._id, class: exam.class._id, status: 'active' })
    .populate('student section').sort({ section: 1, rollNumber: 1 }).lean();
  const marks = await Mark.find({ exam: exam._id }).populate('subject').lean();
  const byStudent = new Map();
  for (const mark of marks) {
    const key = String(mark.student);
    if (!byStudent.has(key)) byStudent.set(key, new Map());
    byStudent.get(key).set(String(mark.subject._id), mark);
  }
  const rows = enrollments.filter((enrollment) => enrollment.student?.status === 'active').map((enrollment) => {
    const subjectMarks = exam.subjects.map((config) => {
      const mark = byStudent.get(String(enrollment.student._id))?.get(String(config.subject._id));
      return { subject: config.subject, mark, result: calculateSubjectResult(mark, config) };
    });
    return { enrollment, subjectMarks, summary: calculateResult(subjectMarks) };
  });
  return { exam, rows };
}
