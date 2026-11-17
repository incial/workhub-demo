import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const axios = require('axios');
const originalAdapter = axios.defaults.adapter;
const values = new Map();
let requests, nextNetwork, events;
globalThis.window = { dispatchEvent: event => { events.push(event.type); } };
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
};
axios.defaults.adapter = async config => {
  requests.push({ url: config.url, data: config.data, authorization: config.headers.get('Authorization') });
  if (nextNetwork) return nextNetwork(config);
  return { data: { token: 'real-test-token', user: { id: 8, name: 'Test User', email: 'normal@example.com', role: 'ROLE_ADMIN' } }, status: 200, statusText: 'OK', headers: {}, config };
};
const built = await build({
  entryPoints: [fileURLToPath(new URL('../services/api.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', external: ['axios'],
  define: { 'import.meta.env.DEV': 'true' }, write: false,
});
const loaded = { exports: {} };
new Function('module', 'exports', 'require', built.outputFiles[0].text)(loaded, loaded.exports, require);
const { authApi, usersApi } = loaded.exports;
test.beforeEach(() => { values.clear(); requests = []; events = []; nextNetwork = undefined; });
test.after(() => { axios.defaults.adapter = originalAdapter; delete globalThis.localStorage; delete globalThis.window; });

test('the demo credentials select local authentication without an API call', async () => {
    const result = await authApi.login(' INCIAL@DEMO.IN ', 'incial');
    assert.equal(result.user.role, 'ROLE_DEMO');
    assert.equal(result.user.email, 'incial@demo.in');
    assert.equal(result.token, 'workhub-demo:local-v1');
  assert.equal(requests.length, 0);
});

test('every other credential is rejected locally without any transport', async () => {
  for (const [email, password] of [['normal@example.com', 'private-test-password'], ['incial@demo.in.example.com', 'incial'], ['someone+incial@demo.in', 'incial'], ['incial@demo.in', ''], ['incial@demo.in', 'INCIAL']]) {
    await assert.rejects(authApi.login(email, password), /demo credentials/i);
  }
  assert.equal(requests.length, 0);
  assert.deepEqual(events, []);
});

test('Google sign-in and public registration are unavailable and never reach a transport', async () => {
  await assert.rejects(authApi.googleLogin('any-credential'), /not available/i);
  await assert.rejects(authApi.registerUser({ name: 'X', email: 'x@staff.example', password: 'secret', role: 'ROLE_EXECUTIVE' }), /disabled/i);
  assert.equal(requests.length, 0);
});

test('the actual directory service reads fictional demo users without private API transport', async () => {
  values.set('token', 'stale-real-token');
  values.set('user', JSON.stringify({ id: 8, email: 'private@real.test', name: 'Private cached person', role: 'ROLE_ADMIN' }));
  values.set('workhub-demo.session.v2', JSON.stringify({ version: 2, actorId: 9001, email: 'incial@demo.in' }));
  const users = await usersApi.getAll();
  assert.ok(users.length > 0);
  assert.equal(users.some(user => user.email === 'private@real.test'), false);
  assert.equal(users.every(user => user.email.endsWith('@demo.in') || user.email.endsWith('.example')), true);
  assert.equal(requests.length, 0);
});

test('a corrupt marker rejects locally without private API transport', async () => {
  values.set('workhub-demo.session.v2', 'broken');
  await assert.rejects(usersApi.getAll(), /demo/i);
  assert.equal(requests.length, 0);
});

test('a damaged session marker expires the local session', async () => {
  values.set('workhub-demo.session.v2', 'broken');
  await assert.rejects(usersApi.getAll(), /session/i);
  assert.deepEqual(events, ['auth:unauthorized']);
  assert.equal(requests.length, 0);
});

test('stale real tokens are ignored and never sent anywhere', async () => {
  values.set('token', 'stale-real-token');
  values.set('workhub-demo.session.v2', JSON.stringify({ version: 2, actorId: 9001, email: 'incial@demo.in' }));
  const me = await authApi.getCurrentUser();
  assert.equal(me.email, 'incial@demo.in');
  assert.equal(requests.length, 0);
});

test('the signed-out password reset flow is simulated locally with the demo code', async () => {
  const sent = await authApi.forgotPassword({ email: 'anyone@school.example' });
  assert.match(sent.message, /123456/);
  await assert.rejects(authApi.changePassword({ email: 'anyone@school.example', newPassword: 'newpassword', otp: '000000' }), /123456/);
  const changed = await authApi.changePassword({ email: 'anyone@school.example', newPassword: 'newpassword', otp: '123456' });
  assert.equal(changed.success, true);
  assert.deepEqual(events, []);
  assert.equal(requests.length, 0);
});

test('every role account signs in with the shared demo password', async () => {
  for (const email of ['superadmin@demo.in', 'admin@demo.in', 'executive@demo.in', 'billing@demo.in', 'accounts@demo.in', 'procurement@demo.in']) {
    const result = await authApi.login(email.toUpperCase(), 'incial');
    assert.equal(result.user.email, email);
    await assert.rejects(authApi.login(email, 'wrong'), /demo credentials/i);
  }
  for (const removed of ['installation@demo.in', 'feedback@demo.in']) await assert.rejects(authApi.login(removed, 'incial'), /demo credentials/i);
  assert.equal(requests.length, 0);
});
