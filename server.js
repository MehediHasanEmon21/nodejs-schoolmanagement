import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { logger } from './src/utils/logger.js';
import { createApp } from './src/app.js';
import { sessionConfig, createSessionStore } from './src/config/session.js';
import User from './src/models/User.js';
import LoginAttempt from './src/models/LoginAttempt.js';
import AcademicYear from './src/models/AcademicYear.js';
import SchoolClass from './src/models/SchoolClass.js';
import Section from './src/models/Section.js';
import Subject from './src/models/Subject.js';
import Student from './src/models/Student.js';
import Teacher from './src/models/Teacher.js';
import Guardian from './src/models/Guardian.js';
import Enrollment from './src/models/Enrollment.js';
import TeacherAssignment from './src/models/TeacherAssignment.js';
import Attendance from './src/models/Attendance.js';
import Exam from './src/models/Exam.js';
import Mark from './src/models/Mark.js';
import FeeType from './src/models/FeeType.js';
import StudentFee from './src/models/StudentFee.js';
import Payment from './src/models/Payment.js';
import TimetableEntry from './src/models/TimetableEntry.js';
import Notice from './src/models/Notice.js';
import { seedAuthorization } from './src/services/authorization.service.js';

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
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(),
    Subject.init(), Student.init(), Teacher.init(), Guardian.init(), Enrollment.init(), TeacherAssignment.init(), Attendance.init(), Exam.init(), Mark.init(), FeeType.init(), StudentFee.init(), Payment.init(), TimetableEntry.init(), Notice.init(),
  ]);
  await seedAuthorization();
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
