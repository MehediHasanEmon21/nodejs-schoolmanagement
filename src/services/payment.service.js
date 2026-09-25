import Payment from '../models/Payment.js';
import StudentFee from '../models/StudentFee.js';
import { canAccessStudentFee, canManageFees, feeSummary, getStudentFee } from './fee.service.js';

export class PaymentFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'PaymentFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  throw new PaymentFormError('This payment reference number already exists.', { referenceNumber: 'This payment reference number already exists.' });
}

export function canCreatePayments(authorization) {
  return canManageFees(authorization);
}

export async function listPayments(studentFeeId, authorization) {
  const fee = await getStudentFee(studentFeeId);
  if (!fee || !await canAccessStudentFee(authorization, fee)) return null;
  const payments = await Payment.find({ studentFee: fee._id }).populate('recordedBy').sort({ paidAt: -1, createdAt: -1 }).lean();
  return { fee, summary: feeSummary(fee), payments };
}

function statusFor(amount, paidAmount, currentStatus) {
  if (['waived', 'cancelled'].includes(currentStatus)) return currentStatus;
  if (paidAmount <= 0) return 'pending';
  if (paidAmount >= amount) return 'paid';
  return 'partial';
}

export async function createPayment(studentFeeId, data, authorization) {
  try {
    if (!canCreatePayments(authorization)) throw Object.assign(new Error('Access denied'), { status: 403 });
    const fee = await getStudentFee(studentFeeId);
    if (!fee) return null;
    const summary = feeSummary(fee);
    if (summary.outstanding <= 0) throw new PaymentFormError('This fee has no outstanding balance.', { amount: 'This fee has no outstanding balance.' });
    if (data.amount > summary.outstanding) throw new PaymentFormError('Payment cannot exceed the outstanding balance.', { amount: 'Payment cannot exceed the outstanding balance.' });
    const payment = await Payment.create({ ...data, studentFee: fee._id, recordedBy: authorization.user.id });
    const paidAmount = Number(fee.paidAmount) + Number(data.amount);
    await StudentFee.updateOne({ _id: fee._id }, {
      $set: { paidAmount, status: statusFor(Number(fee.amount), paidAmount, fee.status), updatedBy: authorization.user.id },
    }, { runValidators: true });
    return payment;
  } catch (error) {
    duplicateError(error);
  }
}
