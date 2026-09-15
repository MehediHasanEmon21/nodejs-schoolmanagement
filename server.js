import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { logger } from './src/utils/logger.js';
import { createApp } from './src/app.js';
import { sessionConfig, createSessionStore } from './src/config/session.js';
import User from './src/models/User.js';
import LoginAttempt from './src/models/LoginAttempt.js';

const port = Number(process.env.PORT ?? 3000);
const uri = process.env.MONGODB_URI;
let server;
let stopping = false;

async function shutdown(exitCode) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await disconnectDatabase();
    process.exit(exitCode);
  } catch {
    logger('server.shutdown_failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

async function start() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const config = sessionConfig();
  await connectDatabase(uri);
  await Promise.all([User.init(), LoginAttempt.init()]);
  const app = createApp({ auth: { config, store: createSessionStore(logger) } });

  if (stopping) return;
  server = app.listen(port, '0.0.0.0', () => {
    logger('server.listening', { port });
  });
  server.on('error', () => {
    logger('server.listen_failed');
    shutdown(1);
  });
}

start().catch(() => {
  logger('server.start_failed');
  shutdown(1);
});
