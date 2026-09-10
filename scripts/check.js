import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
  });
}
const paths = ['server.js', ...['src', 'public/js', 'scripts', 'tests'].flatMap(files)];
for (const path of paths) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(1);
}
console.log(`Syntax checked ${paths.length} JavaScript files.`);
