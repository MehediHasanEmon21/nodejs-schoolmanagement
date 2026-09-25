import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('production Docker strategy uses runtime server and health checks', () => {
  const dockerfile = read('Dockerfile.production');
  assert.match(dockerfile, /FROM node:24-bookworm-slim AS runtime/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/healthz/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.ok(!dockerfile.includes('npm run dev'));
  const compose = read('docker-compose.production.yml');
  assert.match(compose, /dockerfile: Dockerfile\.production/);
  assert.match(compose, /restart: unless-stopped/);
  assert.match(compose, /\/healthz/);
  assert.ok(!compose.includes('.:/app'));
});

test('production environment and documentation avoid committing secrets', () => {
  const env = read('.env.production.example');
  assert.match(env, /NODE_ENV=production/);
  assert.match(env, /SESSION_SECRET=replace_with_a_generated_secret/);
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.production\.example$/m);
  const guide = read('docs/production-readiness.md');
  for (const topic of ['HTTPS', 'Reverse Proxy', 'Health Checks', 'Backups', 'Sessions', 'Logging', 'Deployment And Rollback']) {
    assert.ok(guide.includes(topic), topic);
  }
});
