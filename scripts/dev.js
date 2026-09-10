import { spawn, spawnSync } from 'node:child_process';

// Build before listening, then supervise both watchers without another dependency.
const build = spawnSync('npm', ['run', 'build:css'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(1);
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
        if (error.code !== 'ESRCH') console.error('Could not stop development process.');
      }
    }
  }
  const deadline = setTimeout(() => process.exit(code), 11000);
  deadline.unref();
  Promise.all(children.map((child) => child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve() : new Promise((resolve) => child.once('exit', resolve))))
    .then(() => process.exit(code));
}
for (const script of ['dev:server', 'dev:css']) {
  const child = spawn('npm', ['run', script], { stdio: 'inherit', detached: true });
  children.push(child);
  child.on('error', () => stop(1));
  child.on('exit', () => { if (!stopping) stop(1); });
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
