import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';
import { seedAuthorization } from '../src/services/authorization.service.js';

let hidden = false;
const output = new Writable({ write(chunk, encoding, callback) {
  if (!hidden) process.stdout.write(chunk, encoding);
  callback();
} });
let terminal;
try {
  if (!process.stdin.isTTY) throw new Error('Run setup interactively in a terminal.');
  terminal = createInterface({ input: process.stdin, output, terminal: true });
  const name = await terminal.question('Administrator name: ');
  const email = await terminal.question('Administrator email: ');
  process.stdout.write('Password (12–128 characters, hidden): ');
  hidden = true;
  const password = await terminal.question('');
  hidden = false;
  process.stdout.write('\nConfirm password (hidden): ');
  hidden = true;
  const confirmation = await terminal.question('');
  hidden = false;
  process.stdout.write('\n');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  await connectDatabase(process.env.MONGODB_URI);
  await User.init();
  await seedAuthorization();
  // A deterministic ID makes concurrent first-admin setup attempts mutually exclusive.
  if (await User.exists({ role: 'super_admin' })) throw new Error('A Super Admin already exists.');
  await User.create({ _id: '000000000000000000000001', name, email, password, role: 'super_admin', status: 'active' });
  process.stdout.write('Super Admin created. You can now log in.\n');
} catch (error) {
  const safeMessages = ['Run setup interactively in a terminal.', 'Passwords do not match.', 'A Super Admin already exists.', 'Password must contain 12 to 128 characters.'];
  process.stderr.write((safeMessages.includes(error.message) ? error.message : 'Setup failed. Check account fields and database availability; existing accounts are never overwritten.') + '\n');
  process.exitCode = 1;
} finally {
  terminal?.close();
  await disconnectDatabase();
}
