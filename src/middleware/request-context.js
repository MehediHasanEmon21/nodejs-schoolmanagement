import { randomUUID } from 'node:crypto';

export function requestContext(log) {
  return (request, response, next) => {
    const started = performance.now();
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
      // URLs, query strings, bodies, cookies and headers can contain secrets.
      log('http.request', { requestId, method: request.method,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started) });
    });
    next();
  };
}
