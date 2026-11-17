import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const axios = require('axios');
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
let simulator;
try {
  const built = await build({ entryPoints: [fileURLToPath(new URL('../demo/adapter.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', external: ['axios'], write: false, logLevel: 'silent' });
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(loaded, loaded.exports, require);
  simulator = loaded.exports;
} catch {}
const request = async (url, method = 'get', data, extra = {}) => {
  assert.equal(typeof simulator?.demoAdapter, 'function', 'the local simulator adapter must exist');
  return simulator.demoAdapter({ url, method, data: data === undefined ? undefined : JSON.stringify(data), headers: new axios.AxiosHeaders(), ...extra });
};
const get = async url => (await request(url)).data.data;
const mutate = async (url, data, method = 'post') => (await request(url, method, data)).data.data;
test.beforeEach(() => { values.clear(); values.set('workhub-demo.session.v2', JSON.stringify({ version: 2, actorId: 9001, email: 'incial@demo.in' })); });

test('fictional data fills every workflow stage and never reads real cached records', async () => {
  values.set('projects', JSON.stringify([{ id: 1, school: 'PRIVATE REAL SCHOOL' }]));
  const projects = await get('/projects/all');
  assert.ok(projects.length >= 20);
  for (const stage of ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED']) assert.ok(projects.some(p => p.currentStage === stage), stage);
  assert.equal(JSON.stringify(projects).includes('PRIVATE REAL'), false);
  const users = (await request('/users/all')).data;
  assert.equal(users.find(u => u.id === 9001).role, 'ROLE_DEMO');
  assert.ok(users.some(u => u.role === 'ROLE_EXECUTIVE' && u.zone === 'ZONE_3'));
  assert.ok(users.every(u => u.email.endsWith('@demo.in') || u.email.endsWith('.example')));
});

test('mutations drive dashboard counts, paginated reports, visits and feedback', async () => {
  const created = await mutate('/projects/create', { school: 'Fictional New School', projectName: 'Demo Learning Lab', zone: 'ZONE_2', contactNumber: '+1 202-555-0198', executiveRemarks: 'Demo only' });
  const updated = await mutate(`/projects/${created.id}`, { school: 'Fictional Updated School', projectName: 'Demo Learning Lab', zone: 'ZONE_2', nextContact: '2026-10-31', firstMeetingOutcome: 'POSITIVE' }, 'put');
  assert.equal(updated.school, 'Fictional Updated School');
  for (const toStage of ['ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED']) await mutate(`/projects/${created.id}/transition`, { toStage });
  await mutate(`/projects/${created.id}/sales`, { invoiceAmount: 1000, salesRemarks: 'Fictional order', installationTaskList: 'Install demonstration board', expectedDeliveryDate: '2026-10-31' }, 'put');
  await mutate(`/projects/${created.id}/ready-for-accounts`, {});
  await mutate(`/projects/${created.id}/accounts`, { amountReceived: 400, paymentDate: '2026-10-30', paymentRemarks: 'Demo receipt' }, 'put');
  await mutate(`/projects/${created.id}/accounts`, { amountReceived: 600, paymentDate: '2026-10-30', paymentRemarks: 'Demo balance' }, 'put');
  const paid = await get(`/projects/${created.id}`);
  assert.equal(paid.totalReceived, 1000);
  assert.equal(paid.pendingAmount, 0);
  assert.equal(paid.paymentHistory.length, 2);
  await mutate(`/projects/${created.id}/installation`, { installationStatus: 'WORK_DONE', completionDate: '2026-10-30', installationRemarks: 'Fictional completion' }, 'put');
  const queue = await get('/projects/feedback/queue?zone=ZONE_2&page=1&size=100');
  assert.ok(queue.content.some(p => p.id === created.id));
  await mutate(`/projects/${created.id}/feedback`, { feedbackCollected: true }, 'patch');
  assert.equal((await get('/projects/feedback/queue?zone=ZONE_2')).content.some(p => p.id === created.id), false);
  const report = await get('/reports/projects/tracking/page-data?page=0&size=50&search=Fictional%20Updated');
  assert.equal(report.content[0].pendingAmount, 0);
  assert.equal(report.content[0].stage, 'COMPLETED');
  assert.ok((await get('/projects/completed/archive/export?zone=ZONE_2')).some(p => p.id === created.id));
  const visit = await mutate(`/projects/${created.id}/visits`, { scheduledFor: '2026-10-30', executiveRemark: 'Demo visit', assignedTo: 'executive@demo.in' });
  await mutate(`/school-visits/${visit.id}/outcome`, { visited: true, visitNote: 'Fictional visit completed' }, 'patch');
  assert.equal((await get(`/projects/${created.id}/visits`))[0].status, 'VISITED');
  assert.ok((await get('/audit-logs?page=1&size=100')).content.some(row => row.event === 'PAYMENT RECORDED'));
});

test('production catalog and monthly saves persist into history, trends and analytics', async () => {
  const product = await mutate('/production/products', { name: 'Fictional Science Kit', category: 'Learning' });
  const date = new Date();
  const month = date.getMonth() + 1, year = date.getFullYear();
  const saved = await mutate('/production/summary', { month, year, quantities: [{ productId: product.id, quantity: 17 }] }, 'put');
  assert.equal(saved.entries.find(e => e.productId === product.id).quantity, 17);
  assert.ok((await get(`/production/history?from=${year}-01-01&to=${year}-12-31`)).some(e => e.productId === product.id && e.quantity === 17));
  assert.ok((await get(`/production/trends?year=${year}`)).find(e => e.month === month).totalQuantity >= 17);
  assert.ok((await get('/analytics/dashboard')).productionSummary.currentMonthQuantity >= 17);
  assert.ok(values.has('workhub-demo.data.v3'));
});

test('the adapter rejects missing markers, unknown endpoints and cancellation before writes', async () => {
  const before = await get('/projects/all');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(request('/projects/create', 'post', { school: 'Must not exist' }, { signal: abort.signal }), e => axios.isCancel(e));
  assert.equal((await get('/projects/all')).length, before.length);
  await assert.rejects(request('/unimplemented'), e => e.response?.status === 404);
  for (const marker of [undefined, 'broken', JSON.stringify({ version: 2, actorId: 9001, email: 'private@example.com' })]) {
    marker === undefined ? values.delete('workhub-demo.session.v2') : values.set('workhub-demo.session.v2', marker);
    await assert.rejects(request('/projects/all'), e => e.response?.status === 401);
  }
});

test('unsafe persisted state resets to seeded data and payload credentials never enter storage', async () => {
  values.set('workhub-demo.data.v3', JSON.stringify({ version: 1, projects: [{ id: 3, school: 'PRIVATE RECORD' }] }));
  assert.equal(JSON.stringify(await get('/projects/all')).includes('PRIVATE RECORD'), false);
  const user = (await request('/users/create', 'post', { name: 'Fictional Tester', email: 'tester@staff.example', role: 'ROLE_EXECUTIVE', zone: 'ZONE_1', password: 'DO-NOT-PERSIST' })).data;
  assert.equal(user.password, undefined);
  assert.equal(values.get('workhub-demo.data.v3').includes('DO-NOT-PERSIST'), false);
  const actor = (await request('/users/update/9001', 'put', { role: 'ROLE_SUPER_ADMIN', email: 'changed@staff.example', googleId: 'SECRET' })).data;
  assert.equal(actor.role, 'ROLE_DEMO');
  assert.equal(actor.email, 'incial@demo.in');
  assert.equal(JSON.stringify(actor).includes('SECRET'), false);
});

test('production summaries provide editable zero rows for unsaved products and future periods', async () => {
  const product = await mutate('/production/products', { name: 'Demo New Product', category: 'Furniture' });
  const summary = await get('/production/summary?month=3&year=2030');
  assert.equal(summary.entries.find(entry => entry.productId === product.id)?.quantity, 0);
  assert.equal(summary.entries.length, (await get('/production/products')).length);
  assert.equal((await get('/production/history?from=2030-01-01&to=2030-12-31')).length, 0);
});

test('existing audit explorer event filters and counts reflect real local changes', async () => {
  const before = await get('/audit-logs/counts');
  assert.ok(before.LOGIN_ACTIVITY > 0, 'the default audit tab has fictional login history');
  const project = await mutate('/projects/create', { school: 'Demo Audited School' });
  const visits = await get('/audit-logs?category=PROJECT&events=PROJECT%20CREATED,VISIT%20SCHEDULED');
  assert.ok(visits.content.some(row => row.event === 'PROJECT CREATED' && row.actor.email === 'incial@demo.in'));
  const after = await get('/audit-logs/counts');
  assert.equal(after.PROJECT_VISITING_ACTIVITY, before.PROJECT_VISITING_ACTIVITY + 1);
  await mutate(`/projects/${project.id}/deletion-request`, { reason: 'Fictional duplicate' });
  await mutate(`/projects/${project.id}/deletion-request/review`, { approve: true });
  assert.ok((await get('/audit-logs?events=DELETION%20APPROVED')).content.some(row => row.event === 'DELETION APPROVED'));
});

test('demo profile, password and policy actions are local, persistent and credential free', async () => {
  await request('/users/update-name', 'patch', { name: 'Demo Profile Name' });
  assert.equal((await request('/auth/me')).data.name, 'Demo Profile Name');
  await request('/auth/accept-policy', 'post', { accepted: true, version: 'demo-policy-v1' });
  assert.equal((await request('/auth/me')).data.policyVersion, 'demo-policy-v1');
  await assert.rejects(request('/auth/password/change/confirm', 'post', { otp: '123456', newPassword: 'new-demo-password' }), e => e.response?.status === 400);
  const challenge = (await request('/auth/password/change/request', 'post', { currentPassword: 'incial', newPassword: 'new-demo-password', confirmPassword: 'new-demo-password' })).data;
  assert.match(challenge.message, /123456/);
  assert.equal(values.get('workhub-demo.data.v3').includes('new-demo-password'), false);
  await assert.rejects(request('/auth/password/change/confirm', 'post', { otp: '000000', newPassword: 'new-demo-password' }), e => e.response?.status === 400);
  await request('/auth/password/change/confirm', 'post', { otp: '123456', newPassword: 'new-demo-password' });
  assert.equal(values.get('workhub-demo.data.v3').includes('new-demo-password'), false);
});

test('pagination, zones, executive ownership and search follow existing API contracts', async () => {
  const users = (await request('/users/directory?zone=ZONE_2&roles=ROLE_EXECUTIVE')).data;
  assert.equal(users.length, 1);
  const executive = users[0];
  const rows = await get(`/projects/executive/paged?zone=ZONE_2&executiveId=${executive.id}&page=2&size=2`);
  assert.equal(rows.number, 1);
  assert.equal(rows.content.length, 2);
  assert.ok(rows.content.every(row => row.zone === 'ZONE_2' && row.createdBy === executive.email));
  const reports = await get('/reports/projects/tracking/page-data?page=1&size=2&zone=ZONE_2');
  assert.equal(reports.number, 1);
  assert.ok(reports.content.every(row => row.zone === 'ZONE_2'));
  assert.equal((await get('/projects/all?searchTerm=NoSuchFictionalSchool')).length, 0);
  const tracking = await get(`/tracking/executive?executiveId=${executive.id}`);
  assert.ok(tracking.nonOnboardedProjects.length > 0);
  assert.equal(tracking.leads + tracking.onboarded + tracking.dropped, rows.totalElements);
});

test('every existing read endpoint returns its expected consumer shape locally', async () => {
  const projects = await get('/projects/all');
  const id = projects[0].id;
  const staff = (await request('/users/directory?roles=ROLE_EXECUTIVE')).data[0];
  const endpoints = [
    ['/projects/executive', 'array'], ['/projects/dashboard?role=SALES', 'array'], ['/projects/dashboard/count?role=ACCOUNTS', 'number'],
    ['/projects/dashboard/completed/paged?role=SALES', 'page'], ['/projects/dashboard/badge-counts?role=INSTALLATION', 'object'], ['/projects/dashboard/badge-counts/admin?role=EXECUTIVE', 'object'],
    ['/projects/sales', 'array'], ['/projects/accounts', 'array'], ['/projects/installation?status=UPCOMING', 'array'], ['/projects/completed/paged', 'page'],
    ['/projects/completed/archive/filter', 'page'], ['/projects/completed/count', 'number'], ['/projects/completed/archive/badge-counts', 'object'], ['/projects/completed/metrics', 'object'],
    ['/projects/feedback/queue', 'page'], ['/projects/deletion-requests', 'array'], ['/projects/dropped', 'array'], ['/projects/stage/SALES', 'array'], [`/projects/${id}`, 'object'], [`/projects/${id}/visits`, 'array'],
    ['/school-visits', 'array'], ['/analytics/dashboard', 'object'], ['/analytics/stage-distribution', 'array'], ['/analytics/monthly-trends', 'array'], ['/analytics/financial-summary', 'object'],
    ['/reports', 'array'], ['/reports/projects/tracking', 'array'], ['/reports/executive-activity', 'object'], ['/reports/payments/aging', 'array'], ['/reports/sales/pending-count', 'object'], ['/reports/admin/employee-status', 'array'],
    [`/tracking/user-tracking-data?role=ROLE_EXECUTIVE&userId=${staff.id}`, 'object'], ['/tracking/role-based?role=SALES', 'object'],
    ['/production/products', 'array'], ['/production/summary', 'object'], ['/production/history', 'array'], ['/production/trends', 'array'],
    ['/activity/me', 'object'], [`/activity/statement/${staff.id}`, 'object'], [`/activity/user/${staff.id}`, 'page'], ['/activity/role/ROLE_EXECUTIVE', 'page'], [`/activity/entity/PROJECT/${id}`, 'array'],
    ['/audit-logs', 'page'], ['/audit-logs/counts', 'object'], ['/projects/creation-limit-status', 'object'],
  ];
  for (const [endpoint, shape] of endpoints) {
    const result = await get(endpoint);
    if (shape === 'array') assert.ok(Array.isArray(result), endpoint);
    else if (shape === 'page') assert.ok(Array.isArray(result.content) && Number.isFinite(result.totalElements), endpoint);
    else assert.equal(typeof result, shape, endpoint);
  }
});

const signInAs = (id, email) => values.set('workhub-demo.session.v2', JSON.stringify({ version: 2, actorId: id, email }));

test('each role account signs in as its own seeded user', async () => {
  for (const [id, email, role] of [[9100, 'superadmin@demo.in', 'ROLE_SUPER_ADMIN'], [9101, 'admin@demo.in', 'ROLE_ADMIN'], [9103, 'executive@demo.in', 'ROLE_EXECUTIVE'], [9104, 'billing@demo.in', 'ROLE_SALES_COORDINATOR'], [9105, 'accounts@demo.in', 'ROLE_ACCOUNTS'], [9107, 'procurement@demo.in', 'ROLE_PRODUCTION']]) {
    signInAs(id, email);
    const me = (await request('/auth/me')).data;
    assert.equal(me.email, email);
    assert.equal(me.role, role);
  }
  signInAs(9103, 'billing@demo.in');
  await assert.rejects(request('/auth/me'), /session/i);
});

test('the executive account sees and changes only its own schools', async () => {
  signInAs(9103, 'executive@demo.in');
  const own = await get('/projects/executive');
  assert.ok(own.length >= 5);
  assert.ok(own.every(project => project.createdBy === 'executive@demo.in' && project.zone === 'ZONE_1'));
  signInAs(9001, 'incial@demo.in');
  const other = (await get('/projects/all')).find(project => project.createdBy !== 'executive@demo.in');
  signInAs(9103, 'executive@demo.in');
  await assert.rejects(request(`/projects/${other.id}`), /own schools/);
  await assert.rejects(request(`/projects/${other.id}`, 'put', { school: 'Hijacked' }), /own schools/);
  const created = await mutate('/projects/create', { school: 'Executive Demo School', zone: 'ZONE_3' });
  assert.equal(created.createdBy, 'executive@demo.in');
  assert.equal(created.zone, 'ZONE_1');
  const visit = await mutate(`/projects/${created.id}/visits`, { scheduledFor: '2026-12-01', executiveRemark: 'First visit', assignedTo: 'executive2@staff.example' });
  assert.equal(visit.assignedTo, 'executive@demo.in');
  assert.ok((await get('/school-visits')).every(row => row.assignedTo === 'executive@demo.in'));
});

test('each role may only perform its own workflow step', async () => {
  const salesProject = (await get('/projects/sales'))[0];
  signInAs(9103, 'executive@demo.in');
  await assert.rejects(request(`/projects/${salesProject.id}/sales`, 'put', { invoiceAmount: 1000 }), /Executive account cannot/);
  signInAs(9104, 'billing@demo.in');
  await assert.rejects(request('/projects/create', 'post', { school: 'Not allowed' }), /Billing account cannot/);
  const updated = await mutate(`/projects/${salesProject.id}/sales`, { invoiceAmount: 150000, expectedDeliveryDate: '2026-12-20' }, 'put');
  assert.equal(updated.salesUserEmail ?? 'billing@demo.in', updated.salesUserEmail || 'billing@demo.in');
  signInAs(9105, 'accounts@demo.in');
  await assert.rejects(request('/production/summary', 'put', { month: 1, year: 2026, quantities: [] }), /Accounts account cannot/);
  await assert.rejects(request('/users/create', 'post', { name: 'X', email: 'x@staff.example', role: 'ROLE_EXECUTIVE' }), /cannot/);
  signInAs(9107, 'procurement@demo.in');
  const saved = await mutate('/production/summary', { month: 1, year: 2026, quantities: [{ productId: 12001, quantity: 7 }] }, 'put');
  assert.equal(saved.entries.find(entry => entry.productId === 12001).quantity, 7);
  const history = await get('/production/history?from=2026-01-01&to=2026-01-31');
  assert.equal(history.find(entry => entry.productId === 12001).updatedByEmail, 'procurement@demo.in');
  signInAs(9101, 'admin@demo.in');
  await assert.rejects(request('/users/delete/9103', 'delete'), /login accounts/);
  const audit = await get('/audit-logs?size=200');
  assert.ok(audit.content.some(row => row.actor.email === 'billing@demo.in' && row.actor.role === 'ROLE_SALES_COORDINATOR'));
});
