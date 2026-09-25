import express from 'express';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { requestContext } from './middleware/request-context.js';
import { notFound, errorHandler } from './middleware/error-handler.js';
import { createSessionMiddleware } from './config/session.js';
import { loadAuthentication } from './middleware/auth.js';
import { loadAuthorization } from './middleware/authorization.js';
import { rejectUnsafeRequestData, securityHeaders } from './middleware/security.js';
import { authRoutes } from './routes/auth.js';
import { logger } from './utils/logger.js';

export function createApp({ router = routes, log = logger, environment = process.env.NODE_ENV ?? 'development', auth } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('env', environment);
  app.set('query parser', 'simple');
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views/', import.meta.url)));
  app.locals.activePage = '';
  app.locals.currentUser = null;
  app.locals.csrfToken = null;
  app.locals.navigation = [];
  app.locals.currentRoleName = null;
  app.use(requestContext(log));
  app.use(securityHeaders());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));
  app.use(rejectUnsafeRequestData);
  app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url)), {
    dotfiles: 'ignore', index: false,
  }));
  if (auth) {
    app.set('trust proxy', auth.config.trustProxy);
    app.use(createSessionMiddleware(auth.config, auth.store));
    app.use(loadAuthentication(auth.config));
    app.use(loadAuthorization);
    app.use(authRoutes(auth.config));
  }
  app.use(router);
  app.use(notFound);
  app.use(errorHandler(log));
  return app;
}
