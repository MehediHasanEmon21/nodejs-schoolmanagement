import mongoose from 'mongoose';
import { setTimeout as delay } from 'node:timers/promises';
import { logger } from '../utils/logger.js';

mongoose.connection.on('disconnected', () => logger('database.disconnected'));
mongoose.connection.on('reconnected', () => logger('database.reconnected'));
mongoose.connection.on('error', () => logger('database.error'));

export async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is required.');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger('database.connected');
      return;
    } catch {
      if (attempt === 5) throw new Error('MongoDB connection failed after 5 attempts.');
      logger('database.retry', { attempt });
      await delay(2000);
    }
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
