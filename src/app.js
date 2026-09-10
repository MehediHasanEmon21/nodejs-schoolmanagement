import express from 'express';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { requestContext } from './middleware/request-context.js';
import { notFound, errorHandler } from './middleware/error-handler.js';
import { logger } from './utils/logger.js';

export function createApp({ router = routes, log = logger, environment = process.env.NODE_ENV ?? 'development' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('env', environment);
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views/', import.meta.url)));
  app.locals.activePage = '';
  app.use(requestContext(log));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));
  app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url)), {
    dotfiles: 'ignore', index: false,
  }));
  app.use(router);
  app.use(notFound);
  app.use(errorHandler(log));
  return app;
}

export default createApp();
