function hasDangerousKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => item && typeof item === 'object' && hasDangerousKey(item));
  return Object.entries(value).some(([key, item]) => key.startsWith('$') || key.includes('.') || hasDangerousKey(item));
}

function hasQueryArray(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((item) => Array.isArray(item) || hasQueryArray(item));
}

export function securityHeaders() {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join('; ');
  return (request, response, next) => {
    response.set({
      'Content-Security-Policy': csp,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
    next();
  };
}

export function rejectUnsafeRequestData(request, response, next) {
  if (hasDangerousKey(request.query) || hasDangerousKey(request.body) || hasQueryArray(request.query)) {
    return next(Object.assign(new Error('Unsafe request data'), { status: 400 }));
  }
  next();
}
