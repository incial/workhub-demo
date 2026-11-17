import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const built = await build({
  stdin: {
    contents: `import React from 'react';
      import { renderToString } from 'react-dom/server';
      import { AuthProvider, useAuth } from './context/AuthContext';
      export function readAuth() {
        let value;
        function Probe() { value = useAuth(); return null; }
        renderToString(<AuthProvider><Probe /></AuthProvider>);
        return value;
      }`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['react', 'react-dom/server'],
});
const loaded = { exports: {} };
new Function('module', 'exports', 'require', built.outputFiles[0].text)(loaded, loaded.exports, require);
const { readAuth } = loaded.exports;
let values, transitions;
const marker = JSON.stringify({ version: 1, actorId: 9001, email: 'incial@demo.in' });
test.beforeEach(() => {
  values = new Map(); transitions = [];
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  globalThis.window = {
    location: { pathname: '/crm/', search: '?source=test', hash: '#/dashboard', reload: () => transitions.push({ type: 'reload', values: new Map(values) }) },
    history: { replaceState: (_state, _title, url) => transitions.push({ type: 'replace', url }) },
  };
});
test.after(() => { delete globalThis.localStorage; delete globalThis.window; });

test('restored demo identity never reuses an active real account', () => {
  values.set('workhub-demo.session.v1', marker);
  values.set('token', 'real-token');
  values.set('user', JSON.stringify({ id: 8, name: 'Real User', email: 'real@example.com', role: 'ROLE_ADMIN' }));
  const auth = readAuth();
  assert.equal(auth.isDemo, true);
  assert.equal(auth.user.role, 'ROLE_DEMO');
  assert.equal(auth.user.email, 'incial@demo.in');
});

test('entering demo clears real auth and replaces the destination before reload', () => {
  for (const key of ['token', 'user', 'loginTimestamp']) values.set(key, 'stale-real-auth');
  values.set('other.application', 'keep');
  readAuth().login('workhub-demo:local-v1', { id: 9001, name: 'Demo User', email: 'incial@demo.in', role: 'ROLE_DEMO' });
  assert.equal(values.get('workhub-demo.session.v1'), marker);
  for (const key of ['token', 'user', 'loginTimestamp']) assert.equal(values.has(key), false);
  assert.equal(values.get('other.application'), 'keep');
  assert.deepEqual(transitions.map(value => value.type), ['replace', 'reload']);
  assert.equal(transitions[0].url, '/crm/?source=test#/dashboard');
});

test('demo logout clears active identity and reloads the main login page', () => {
  values.set('workhub-demo.session.v1', marker);
  for (const key of ['token', 'user', 'loginTimestamp']) values.set(key, 'stale-auth');
  values.set('other.application', 'keep');
  readAuth().logout();
  assert.deepEqual(transitions.map(value => value.type), ['replace', 'reload']);
  assert.equal(transitions[0].url, '/crm/?source=test#/login');
  for (const key of ['workhub-demo.session.v1', 'token', 'user', 'loginTimestamp']) assert.equal(transitions[1].values.has(key), false);
  assert.equal(readAuth().isAuthenticated, false);
  assert.equal(values.get('other.application'), 'keep');
});

test('corrupt demo markers restore no real identity and logout recovers normal login', () => {
  values.set('workhub-demo.session.v1', 'broken');
  values.set('token', 'real-token');
  values.set('user', JSON.stringify({ id: 8, name: 'Real User', email: 'real@example.com', role: 'ROLE_ADMIN' }));
  assert.equal(readAuth().isAuthenticated, false);
  readAuth().logout();
  assert.equal(values.has('workhub-demo.session.v1'), false);
  assert.equal(transitions[0].url, '/crm/?source=test#/login');
});

test('real tokens in storage never authenticate the showcase build', () => {
  values.set('token', 'real-token');
  values.set('user', JSON.stringify({ id: 8, name: 'Real User', email: 'real@example.com', role: 'ROLE_ADMIN' }));
  assert.equal(readAuth().isAuthenticated, false);
  assert.throws(() => readAuth().login('real-token', { id: 8, name: 'Real User', email: 'real@example.com', role: 'ROLE_ADMIN' }), /demo account/i);
  assert.equal(values.has('workhub-demo.session.v1'), false);
  assert.deepEqual(transitions, []);
});
