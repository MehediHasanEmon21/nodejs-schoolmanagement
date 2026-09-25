import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoSeedPassword, demoSeedUsers, assertDemoSeedAllowed } from '../src/services/demo-seed.service.js';

test('demo seed credentials are explicit local-review accounts', () => {
  assert.equal(demoSeedPassword, 'DemoPass12345!');
  assert.deepEqual(demoSeedUsers.map((user) => user.email), [
    'demo.admin@example.test',
    'demo.teacher@example.test',
    'demo.student@example.test',
    'demo.guardian@example.test',
  ]);
  assert.deepEqual(demoSeedUsers.map((user) => user.role), ['admin', 'teacher', 'student', 'guardian']);
});

test('demo seeding is guarded in production environments', () => {
  assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'production' }), /disabled in production/);
  assert.doesNotThrow(() => assertDemoSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED_IN_PRODUCTION: 'true' }));
  assert.doesNotThrow(() => assertDemoSeedAllowed({ NODE_ENV: 'development' }));
});
