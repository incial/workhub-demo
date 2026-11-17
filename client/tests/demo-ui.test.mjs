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
      import { AuthProvider } from './context/AuthContext';
      import { OperatorViewProvider, useOperatorView } from './context/OperatorViewContext';
      export function view() {
        let value;
        function Probe() { value = useOperatorView(); return null; }
        renderToString(<AuthProvider><OperatorViewProvider><Probe /></OperatorViewProvider></AuthProvider>);
        return value;
      }`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx',
  }, bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['react', 'react-dom/server'],
});
const loaded = { exports: {} };
new Function('module', 'exports', 'require', built.outputFiles[0].text)(loaded, loaded.exports, require);
let values;
test.beforeEach(() => {
  values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
});
test.after(() => { delete globalThis.localStorage; });
const demo = () => values.set('workhub-demo.session.v1', JSON.stringify({ version: 1, actorId: 9001, email: 'incial@demo.in' }));

test('demo opens the actual admin workspace with the existing view selector', () => {
  demo();
  assert.equal(loaded.exports.view().effectiveRole, 'ROLE_ADMIN');
  assert.equal(loaded.exports.view().isOperator, true);
});

test('demo ignores real workspace preferences and restores only its own view', () => {
  demo();
  values.set('operatorViewMode', 'GOD');
  assert.equal(loaded.exports.view().effectiveRole, 'ROLE_ADMIN');
  values.set('workhub-demo.ui.operatorViewMode', 'SUPER_ADMIN');
  assert.equal(loaded.exports.view().effectiveRole, 'ROLE_SUPER_ADMIN');
  assert.equal(values.get('operatorViewMode'), 'GOD');
});

test('without a demo session no workspace role is granted, even with a real cached user', () => {
  values.set('token', 'real-test-token');
  values.set('user', JSON.stringify({ id: 8, name: 'Test Operator', email: 'operator@example.com', role: 'ROLE_OPERATOR' }));
  assert.equal(loaded.exports.view().effectiveRole, undefined);
  assert.equal(loaded.exports.view().isOperator, false);
});

test('the removed GOD view falls back to Admin and never grants the operator role', () => {
  demo();
  values.set('workhub-demo.ui.operatorViewMode', 'GOD');
  assert.equal(loaded.exports.view().effectiveRole, 'ROLE_ADMIN');
  assert.equal(loaded.exports.view().operatorViewMode, 'ADMIN');
});
