import { paymentFormValues, validatePayment } from '../validators/payment.validator.js';
import { PaymentFormError, createPayment, listPayments } from '../services/payment.service.js';

const notFound = () => Object.assign(new Error('Payment record not found'), { status: 404 });

async function renderForm(response, { fee, summary, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('fees/payment-form', {
    title: 'Record payment',
    activePage: 'fees',
    fee,
    summary,
    values: values ?? paymentFormValues(),
    errors,
    message,
  });
}

export async function history(request, response, next) {
  const result = await listPayments(request.params.feeId, request.authorization);
  if (!result) return next(notFound());
  response.render('fees/payments', { title: `${result.fee.feeType.name} payments`, activePage: 'fees', ...result });
}

export async function create(request, response, next) {
  const result = await listPayments(request.params.feeId, request.authorization);
  if (!result) return next(notFound());
  await renderForm(response, { ...result, values: paymentFormValues({ amount: result.summary.outstanding }) });
}

export async function store(request, response, next) {
  const result = await listPayments(request.params.feeId, request.authorization);
  if (!result) return next(notFound());
  const { data, values, errors } = validatePayment(request.body);
  if (Object.keys(errors).length) return renderForm(response, { ...result, values, errors, message: 'Please check the payment details.', status: 422 });
  try {
    await createPayment(request.params.feeId, data, request.authorization);
    response.redirect(303, `/fees/${request.params.feeId}/payments?created=1`);
  } catch (error) {
    if (error instanceof PaymentFormError) return renderForm(response, { ...result, values, errors: error.errors, message: error.message, status: error.status });
    throw error;
  }
}
