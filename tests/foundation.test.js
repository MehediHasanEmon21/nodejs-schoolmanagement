import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import ejs from 'ejs';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/utils/logger.js';
import { connectDatabase } from '../src/config/database.js';

async function serve(t, options = {}) {
  const lines = [];
  const app = createApp({ ...options, log: createLogger((line) => lines.push(JSON.parse(line))) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { app, lines, fetch: (path, init) => fetch(base + path, init) };
}

function render(partial, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/partials/${partial}.ejs`, import.meta.url)), data);
}

function testRouter() {
  const router = express.Router();
  router.post('/echo', (request, response) => response.json(request.body));
  router.get('/fail', async () => { throw new TypeError('private password=secret mongodb://credentials'); });
  router.get('/bad-status', () => { throw Object.assign(new Error('private'), { status: 302 }); });
  return router;
}

test('home renders shared layout and serves compiled styles, script and image', async (t) => {
  const app = await serve(t);
  const response = await app.fetch('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await response.text();
  for (const content of ['Every school day, connected.', 'Main navigation', 'Skip to content', '<footer', '/css/app.css', '/js/app.js']) {
    assert.ok(html.includes(content), content);
  }
  for (const [path, mime, marker] of [
    ['/css/app.css', /text\/css/, '.btn-primary'],
    ['/js/app.js', /javascript/, 'aria-expanded'],
    ['/images/school-mark.svg', /image\/svg\+xml/, '<svg'],
  ]) {
    const asset = await app.fetch(path);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), mime);
    assert.ok((await asset.text()).includes(marker));
  }
});

test('health check returns a no-store JSON status', async (t) => {
  const app = await serve(t);
  const response = await app.fetch('/healthz');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unknown paths and private files get an escaped HTML 404', async (t) => {
  const app = await serve(t);
  for (const path of ['/missing?token=private', '/.env', '/server.js', '/src/app.js', '/%3Cscript%3E']) {
    const response = await app.fetch(path);
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.match(html, /Page not found/);
    assert.ok(!html.includes('token=private'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes(response.headers.get('x-request-id')));
  }
});

test('JSON and URL-encoded forms parse; invalid and oversized bodies fail safely', async (t) => {
  const app = await serve(t, { router: testRouter() });
  for (const [contentType, body] of [['application/json', '{"name":"Ada"}'], ['application/x-www-form-urlencoded', 'name=Ada']]) {
    const response = await app.fetch('/echo', { method: 'POST', headers: { 'Content-Type': contentType }, body });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { name: 'Ada' });
  }
  for (const [contentType, body, status] of [
    ['application/json', '{"password":"private",', 400],
    ['application/json', JSON.stringify({ text: 'x'.repeat(103000) }), 413],
    ['application/x-www-form-urlencoded', Array.from({ length: 101 }, (_, i) => `k${i}=private`).join('&'), 413],
    ['application/json', JSON.stringify({ $where: 'private' }), 400],
    ['application/json', JSON.stringify({ profile: { 'password.hash': 'private' } }), 400],
  ]) {
    const response = await app.fetch('/echo', { method: 'POST', headers: { 'Content-Type': contentType }, body });
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes('private'));
  }
  const polluted = await app.fetch('/echo?name=Ada&name=Grace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"ok":true}' });
  assert.equal(polluted.status, 400);
});

test('async failures return safe production pages and correlated logs without secrets', async (t) => {
  const app = await serve(t, { router: testRouter(), environment: 'production' });
  const response = await app.fetch('/fail?token=private', { headers: { Authorization: 'Bearer private', Cookie: 'session=private', 'X-Request-Id': 'private' } });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /Something went wrong/);
  for (const value of ['private', 'mongodb://', 'TypeError', 'Development diagnostic', 'foundation.test.js']) {
    assert.ok(!html.includes(value));
  }
  const requestId = response.headers.get('x-request-id');
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.ok(app.lines.some((entry) => entry.event === 'http.error' && entry.requestId === requestId));
  assert.ok(app.lines.some((entry) => entry.event === 'http.request' && entry.status === 500 && entry.requestId === requestId));
  assert.ok(!JSON.stringify(app.lines).includes('private'));
  assert.equal((await app.fetch('/bad-status')).status, 500);
});

test('development debugging identifies error category without raw exception contents', async (t) => {
  const app = await serve(t, { router: testRouter(), environment: 'development' });
  const response = await app.fetch('/fail');
  const html = await response.text();
  assert.equal(response.status, 500);
  assert.match(html, /Development diagnostic: TypeError/);
  assert.ok(!html.includes('password=secret'));
});

test('a broken error view falls back to a safe response', async (t) => {
  const app = await serve(t, { router: testRouter(), environment: 'production' });
  app.app.set('views', '/nonexistent-phase3-views');
  const response = await app.fetch('/fail');
  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /text\/plain/);
  assert.equal(await response.text(), 'Something went wrong. Please try again shortly.');
  assert.ok(app.lines.some((line) => line.event === 'view.error'));
});

test('shared controls escape content, associate errors and never repopulate passwords', async () => {
  const attack = '<script>alert("private")</script>';
  const control = await render('form-control', { name: 'email', label: attack, value: attack, error: attack, required: true });
  assert.ok(!control.includes('<script>'));
  assert.match(control, /aria-invalid="true"/);
  assert.match(control, /aria-describedby="email-help"/);
  assert.match(control, /for="email"/);
  const password = await render('form-control', { name: 'password', type: 'password', label: 'Password', value: 'private' });
  assert.ok(!password.includes('private'));
  const select = await render('form-control', { name: 'choice', label: 'Choice', value: 'a', options: [{value: 'a', label: attack}] });
  assert.match(select, /selected/);
  assert.ok(!select.includes('<script>'));
  const textarea = await render('form-control', { name: 'notes', label: 'Notes', type: 'textarea', value: '</textarea><script>' });
  assert.ok(!textarea.includes('<script>'));
  const alert = await render('alert', { kind: 'error', message: attack });
  assert.match(alert, /role="alert"/);
  assert.ok(!alert.includes('<script>'));
  const button = await render('button', { label: attack, disabled: true });
  assert.match(button, /type="button"/);
  assert.match(button, /disabled/);
  assert.ok(!button.includes('<script>'));
});

test('table, breadcrumbs and pagination handle content and empty/boundary states', async () => {
  const table = await render('table', { caption: 'Records', columns: [{ key: 'name', label: 'Name' }], rows: [{ name: '<script>' }] });
  assert.ok(!table.includes('<script>'));
  assert.match(table, /scope="col"/);
  const empty = await render('table', { caption: 'Records', columns: [{ key: 'name', label: 'Name' }], rows: [] });
  assert.match(empty, /No records to display/);
  const first = await render('pagination', { page: 1, totalPages: 2, nextUrl: '/?page=2' });
  assert.match(first, /aria-disabled="true">Previous/);
  assert.match(first, /href="\/\?page=2" rel="next"/);
  const last = await render('pagination', { page: 2, totalPages: 2, previousUrl: '/?page=1' });
  assert.match(last, /aria-disabled="true">Next/);
  const crumbs = await render('breadcrumbs', { items: [{ label: 'Home', href: '/' }, { label: '<script>' }] });
  assert.match(crumbs, /aria-current="page"/);
  assert.ok(!crumbs.includes('<script>'));
});

test('database configuration rejects a missing URI without opening a connection', async () => {
  await assert.rejects(connectDatabase(''), /MONGODB_URI is required/);
});
