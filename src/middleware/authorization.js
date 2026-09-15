import { roleNames } from '../config/authorization.js';
import { resolveAuthorization, hasRole, hasPermission, canAccessResource } from '../services/authorization.service.js';

const denied = (status = 403) => Object.assign(new Error('Access denied'), { status });

export async function loadAuthorization(request, response, next) {
  request.authorization = await resolveAuthorization(request.user);
  next();
}

export function requireRole(...roles) {
  if (!roles.length || roles.some((role) => !roleNames.includes(role))) throw new Error('Specify valid allowed roles.');
  return (request, response, next) => {
    if (!request.user) return response.redirect(302, '/login');
    if (!roles.some((role) => hasRole(request.authorization, role))) return next(denied());
    next();
  };
}

function validatePermissions(permissions) {
  if (!permissions.length || permissions.some((permission) => typeof permission !== 'string' ||
      !/^[a-z][a-z_]*\.[a-z][a-z_]*$/.test(permission))) throw new Error('Specify valid required permissions.');
}

export function requirePermission(...permissions) {
  validatePermissions(permissions);
  return (request, response, next) => {
    if (!request.user) return response.redirect(302, '/login');
    if (!permissions.every((permission) => hasPermission(request.authorization, permission))) return next(denied());
    next();
  };
}

export function requireResource(permission, { load, policy, allowSuperAdmin = false } = {}) {
  validatePermissions([permission]);
  if (typeof load !== 'function' || typeof policy !== 'function' || typeof allowSuperAdmin !== 'boolean') {
    throw new Error('Resource access requires a loader, policy, and a boolean bypass option.');
  }
  return async (request, response, next) => {
    if (!request.user) return response.redirect(302, '/login');
    if (!hasPermission(request.authorization, permission)) return next(denied());
    const resource = await load(request);
    if (!await canAccessResource(request.authorization, permission, resource, policy, { allowSuperAdmin })) {
      // Do not disclose whether a resource exists outside the caller's scope.
      return next(denied(404));
    }
    request.resource = resource;
    next();
  };
}
