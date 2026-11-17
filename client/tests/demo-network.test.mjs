import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('../demo/network.ts', import.meta.url));
let bundled;
async function browser(marker = null, storageThrows = false) {
  assert.ok(existsSync(source), 'The demo needs a browser isolation boundary before application startup');
  bundled ??= (await build({ entryPoints: [source], bundle: true, platform: 'browser', format: 'cjs', write: false })).outputFiles[0].text;
  const requests = [], policies = [], listeners = new Map(), values = new Map();
  if (marker !== null) values.set('workhub-demo.session.v1', marker);
  const record = name => (...args) => { requests.push({ name, args }); return Promise.resolve('sent'); };
  class Form { submit() { requests.push({ name: 'form' }); } requestSubmit() { requests.push({ name: 'form-request' }); } }
  const document = {
    createElement: tagName => ({ tagName }),
    head: { appendChild: node => policies.push(node) },
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  const window = {
    location: { origin: 'https://workhub.example', href: 'https://workhub.example/#/dashboard' },
    fetch: record('fetch'), open: record('open'), HTMLFormElement: Form,
    navigator: { sendBeacon: record('beacon'), serviceWorker: { register: record('service-worker') } },
  };
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'Worker', 'SharedWorker', 'RTCPeerConnection', 'webkitRTCPeerConnection']) {
    window[name] = class { constructor(...args) { requests.push({ name, args }); } };
  }
  const module = { exports: {} };
  const localStorage = { getItem: key => { if (storageThrows) throw Error('Storage unavailable'); return values.get(key) ?? null; } };
  runInNewContext(bundled, { module, exports: module.exports, window, document, localStorage, URL, Promise });
  return { ...module.exports, window, requests, policies, listeners, values, Form };
}

test('the boundary is always active and installs before sign-in', async () => {
  const context = await browser();
  context.installDemoBoundary();
  assert.equal(context.isDemoBoundaryActive(), true);
  assert.equal(context.policies.length, 1);
  await assert.rejects(context.window.fetch('/api/v1/users'), /demo|isolated/i);
  assert.match(context.safeDemoImage('https://images.example/avatar.png'), /^data:image\/svg\+xml,/);
  assert.deepEqual(context.requests, []);
});

test('valid, malformed, and empty demo markers all deny every network transport', async () => {
  for (const marker of ['{"version":1,"actorId":9001,"email":"incial@demo.in"}', 'broken', '']) {
    const context = await browser(marker);
    assert.equal(context.isDemoBoundaryActive(), true);
    context.installDemoBoundary();
    await assert.rejects(context.window.fetch('/api/v1/users'), /demo|isolated/i);
    await assert.rejects(context.window.fetch('https://outside.example/collect'), /demo|isolated/i);
    for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'Worker', 'SharedWorker', 'RTCPeerConnection', 'webkitRTCPeerConnection']) {
      assert.throws(() => new context.window[name]('https://outside.example/collect'), /demo|isolated/i);
    }
    assert.equal(context.window.navigator.sendBeacon('/api/v1/users', 'fictional'), false);
    await assert.rejects(context.window.navigator.serviceWorker.register('/worker.js'), /demo|isolated/i);
    assert.deepEqual(context.requests, []);
  }
});

test('storage errors fail closed and boundary removal requires a fresh document', async () => {
  const unavailable = await browser(null, true);
  assert.equal(unavailable.isDemoBoundaryActive(), true);
  unavailable.installDemoBoundary();
  await assert.rejects(unavailable.window.fetch('/api/v1/users'), /demo|isolated/i);

  const active = await browser('broken');
  active.installDemoBoundary();
  active.values.clear();
  active.installDemoBoundary();
  assert.equal(active.isDemoBoundaryActive(), true);
  assert.equal(active.policies.length, 1);
  await assert.rejects(active.window.fetch('/api/v1/users'), /demo|isolated/i);
  assert.equal((await browser()).isDemoBoundaryActive(), true);
});

test('the browser policy denies connections and frames while keeping local app chunks loadable', async () => {
  const context = await browser('broken');
  context.installDemoBoundary();
  assert.equal(context.policies.length, 1);
  assert.equal(context.policies[0].httpEquiv, 'Content-Security-Policy');
  const directives = new Map(context.policies[0].content.split(';').map(value => value.trim().split(/\s+/)).map(([name, ...rules]) => [name, rules]));
  for (const name of ['connect-src', 'frame-src', 'worker-src', 'object-src', 'form-action']) assert.deepEqual(directives.get(name), ["'none'"]);
  assert.ok(directives.get('script-src').includes("'self'"));
  assert.ok(directives.get('style-src').includes("'self'"));
  assert.ok(!directives.get('img-src').includes("'self'"), 'Same-origin API URLs must not be loaded as images');
});

test('demo images reject remote hosts and API URLs while local demo images remain usable', async () => {
  const context = await browser('broken');
  const logo = context.safeDemoImage('https://images.example/avatar.png');
  assert.match(logo, /^data:image\/svg\+xml,/);
  for (const unsafe of [undefined, '', '//images.example/avatar.png', '/api/v1/users', 'https://workhub.example/api/v1/users', 'javascript:alert(1)', 'data:text/html,<script>bad</script>', 'blob:https://outside.example/id', '/demo/../api/v1/users']) {
    assert.equal(context.safeDemoImage(unsafe), logo);
  }
  for (const safe of ['data:image/png;base64,aW1hZ2U=', 'blob:https://workhub.example/demo-image', '/demo/avatar.svg', 'https://workhub.example/demo/avatar.svg']) {
    assert.equal(context.safeDemoImage(safe), safe);
  }
});

function click(context, href, type = 'click') {
  let prevented = false;
  const event = {
    target: { closest: () => ({ getAttribute: () => href }) },
    preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => {},
  };
  context.listeners.get(type)?.(event);
  return prevented;
}

test('demo navigation rejects external links, forms, and popups but allows local routes and exports', async () => {
  const context = await browser('broken');
  context.installDemoBoundary();
  for (const href of ['https://outside.example', '//outside.example', '/api/v1/export', 'mailto:real@example.com', 'tel:1234', 'javascript:alert(1)']) {
    assert.equal(click(context, href), true);
    assert.equal(click(context, href, 'auxclick'), true);
    assert.equal(context.window.open(href), null);
  }
  assert.equal(click(context, '#/projects'), false);
  assert.equal(click(context, 'blob:https://workhub.example/demo-export'), false);
  assert.throws(() => new context.Form().submit(), /demo|isolated/i);
  assert.throws(() => new context.Form().requestSubmit(), /demo|isolated/i);
  let prevented = false, stopped = false;
  context.listeners.get('submit')({ preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
  assert.equal(prevented, true);
  assert.equal(stopped, false, 'Local React submit handlers must still receive demo form events');
  assert.deepEqual(context.requests, []);
});
