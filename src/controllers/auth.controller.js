import { validateLogin } from '../validators/auth.validator.js';
import { authenticate, sessionAction } from '../services/auth.service.js';
import { cookieName, cookieOptions } from '../config/session.js';

export function showLogin(request, response) {
  response.render('auth/login', { title: 'Log in', activePage: 'login', email: '', errors: {}, message: null });
}
export async function login(request, response) {
  const { email, password, errors } = validateLogin(request.body);
  const render = (status, message) => response.status(status).render('auth/login', {
    title: 'Log in', activePage: 'login', email, errors, message,
  });
  if (Object.keys(errors).length) return render(422, 'Please check your login details.');
  const user = await authenticate(email, password);
  if (!user) return render(401, 'Invalid email or password.');
  await sessionAction(request, 'regenerate');
  request.session.userId = user.id;
  request.session.startedAt = Date.now();
  request.session.lastSeenAt = request.session.startedAt;
  await sessionAction(request, 'save');
  response.redirect(303, '/dashboard');
}
export function logout(config) {
  return async (request, response) => {
    await sessionAction(request, 'destroy');
    response.clearCookie(cookieName, cookieOptions(config));
    response.redirect(303, '/login');
  };
}
export function showDashboard(request, response) {
  response.render('dashboard/index', { title: 'Dashboard', activePage: 'dashboard' });
}
