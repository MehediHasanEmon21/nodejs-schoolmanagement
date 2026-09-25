import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { cleanupDemoSeedData, seedDemoData } from '../src/services/demo-seed.service.js';

const cleanupOnly = process.argv.includes('--cleanup');

try {
  await connectDatabase(process.env.MONGODB_URI);
  if (cleanupOnly) {
    const deleted = await cleanupDemoSeedData();
    process.stdout.write(`Demo seed data cleaned up: ${JSON.stringify(deleted)}\n`);
  } else {
    const result = await seedDemoData();
    process.stdout.write('Demo seed data is ready.\n');
    process.stdout.write(`Records created: ${JSON.stringify(result.counts)}\n`);
    process.stdout.write('Demo logins:\n');
    for (const credential of result.credentials) {
      process.stdout.write(`- ${credential.role}: ${credential.email} / ${credential.password}\n`);
    }
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
