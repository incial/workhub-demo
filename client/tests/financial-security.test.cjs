const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../utils.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const utils = { exports: {} };
new Function('module', 'exports', compiled)(utils, utils.exports);
const retry = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/paymentRetry.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(retry, retry.exports);

test('CSV treats formulas as text and preserves quotes, commas, lines and numeric negatives', () => {
  for (const input of ['=1+1', '+cmd', '-cmd', '@SUM(A1)', '\t=1', '\uFEFF=1']) {
    assert.equal(utils.exports.escapeCsvCell(input), `"'${input}"`);
  }
  assert.equal(utils.exports.escapeCsvCell('School "A", Kerala\nIndia'), '"School ""A"", Kerala\nIndia"');
  assert.equal(utils.exports.escapeCsvCell(-12.5), '"-12.5"');
});
test('invoice edits and payments use exact paise in the preview', () => {
  assert.deepEqual(utils.exports.paymentPreview(200, 60, 10), { totalReceived: 70, pending: 130 });
  assert.deepEqual(utils.exports.paymentPreview(0.3, 0.1, 0.2), { totalReceived: 0.3, pending: 0 });
  assert.deepEqual(utils.exports.paymentPreview(120, 60), { totalReceived: 60, pending: 60 });
});
test('payment retries survive blocked storage and use a fresh ID after confirmed success', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  let sequence = 0; const uuid = () => `synthetic-${++sequence}`;
  const first = retry.exports.paymentRequestId(1, { amountReceived: 10, paymentDate: '2026-10-04' }, storage, uuid);
  assert.equal(retry.exports.paymentRequestId(1, { paymentDate: '2026-10-04', amountReceived: 10 }, storage, uuid), first);
  retry.exports.completePaymentRequest(1, storage);
  assert.notEqual(retry.exports.paymentRequestId(1, { amountReceived: 10, paymentDate: '2026-10-04' }, storage, uuid), first);
  assert.notEqual(retry.exports.paymentRequestId(1, { amountReceived: 20, paymentDate: '2026-10-04' }, storage, uuid), first);
});
