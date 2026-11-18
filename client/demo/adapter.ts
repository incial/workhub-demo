import { AxiosError, CanceledError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import type { ActivityActionType, ActivityEntityType, AuditCategory, Project, ProjectStage, User, UserRole, Zone } from '../types';
import { DEMO_ACCOUNTS, DEMO_ACTOR_ID, restoreDemoSession } from './session';
import { fictionalEmail, readDemoState, writeDemoState, type DemoState } from './store';
import { dateOffset, now, today } from './seed';
import { activityStatement, analytics, bucket, color, contains, dashboardProjects, filteredProjects, inRange, matches, page, productionEntries, productionSummary, projectView, reportRows, sum, trackedProjects, trackingData, trackingProjects } from './projections';

class DemoError extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string): never => { throw new DemoError(status, message); };
const requireValue = (value: unknown, message: string) => { if (!value) fail(400, message); };
const text = (value: unknown, max = 2000) => String(value ?? '').trim().slice(0, max).replace(/https?:\/\/\S+/gi, '[local demo link omitted]');
const numeric = (value: unknown, label: string) => { const amount = Number(value); if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) fail(400, `${label} must be a non-negative number.`); return amount; };
const date = (value: unknown, label: string) => { const result = text(value, 40); if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(result) || !Number.isFinite(Date.parse(result))) fail(400, `${label} must be a valid date.`); return result; };
const nextId = (rows: { id?: number; entryId?: number }[], start = 20000) => Math.max(start, ...rows.map(row => row.id ?? row.entryId ?? start)) + 1;
/** The signed-in demo user for the request being handled (set once per request; handlers are synchronous). */
let me: User;
const actor = (_state?: DemoState) => me;
const ADMIN_ROLES: UserRole[] = ['ROLE_DEMO', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'];
const isLoginAccount = (id: number) => DEMO_ACCOUNTS.some(account => account.id === id);
const titleCase = (value: string) => value.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const roleName = (role: UserRole) => role === 'ROLE_PRODUCTION' ? 'Procurement' : role === 'ROLE_SALES_COORDINATOR' ? 'Billing' : titleCase(role.replace('ROLE_', '').toLowerCase().replace(/_/g, ' '));
/** Server-style role check: admins may do everything, other roles only their own workflow step. */
const allow = (...roles: UserRole[]) => { if (!ADMIN_ROLES.includes(me.role) && !roles.includes(me.role)) fail(403, `The ${roleName(me.role)} account cannot perform this action.`); };
/** Executives only see and change projects they own, like the backend's ZoneAccessService. */
const ownsProject = (project: Project) => me.role !== 'ROLE_EXECUTIVE' || project.createdBy === me.email;
const requireOwner = (project: Project) => { if (!ownsProject(project)) fail(403, 'Executives can only work on their own projects.'); return project; };
const projectById = (state: DemoState, id: number) => state.projects.find(project => project.id === id) ?? fail(404, 'Fictional project not found.');
const userById = (state: DemoState, id: number) => state.users.find(user => user.id === id) ?? fail(404, 'Fictional user not found.');
const projectBaseFields = ['school', 'contactPerson', 'contactNumber', 'place', 'district', 'region', 'zone', 'projectName', 'parentCompany', 'executiveRemarks', 'lastContact', 'nextContact', 'firstMeetingOutcome', 'projectValue', 'invoiceAmount', 'isExtraWorkNeeded'];
const roles: UserRole[] = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_EMPLOYEE', 'ROLE_CLIENT', 'ROLE_EXECUTIVE', 'ROLE_SALES_COORDINATOR', 'ROLE_ACCOUNTS', 'ROLE_INSTALLATION', 'ROLE_PRODUCTION', 'ROLE_ZONAL_MANAGER', 'ROLE_OPERATOR', 'ROLE_FEEDBACK'];
const stages: ProjectStage[] = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED'];
type Payload = Record<string, unknown>;

function assignFields(target: object, data: Payload, fields: string[]): void {
  const record = target as Record<string, unknown>;
  for (const key of fields) if (data[key] !== undefined && data[key] !== null) {
    if (key === 'zone') { requireValue(['ZONE_1', 'ZONE_2', 'ZONE_3'].includes(String(data[key])), 'Choose a demo zone.'); record[key] = data[key]; }
    else if (/Amount|Value|Received/.test(key)) record[key] = numeric(data[key], key);
    else if (typeof data[key] === 'boolean') record[key] = data[key];
    else if (/Date$|^lastContact$|^nextContact$/.test(key)) record[key] = data[key] === '' ? undefined : date(data[key], key);
    else record[key] = text(data[key]);
  }
}

function log(state: DemoState, actionType: ActivityActionType, entityType: ActivityEntityType, entityId: number, event: string, description: string, project?: Project, category: AuditCategory = 'PROJECT') {
  const user = actor(state), timestamp = now();
  state.activities.push({ id: nextId(state.activities), userId: user.id, userRole: user.role, actionType, entityType, entityId, timestamp, metadata: { description, ...(project ? { school: project.school, projectName: project.projectName, zone: project.zone } : {}) } });
  state.audits.push({ id: nextId(state.audits), event, description, projectName: project?.projectName, amountReceived: project?.amountReceived, pendingAmount: project?.pendingAmount, actor: { name: user.name, email: user.email, role: user.role, zone: user.zone ?? project?.zone }, category, timestamp });
  state.activities = state.activities.slice(-2000); state.audits = state.audits.slice(-2000);
}

function changeStage(project: Project, toStage: ProjectStage) {
  requireValue(stages.includes(toStage), 'Choose a valid workflow stage.');
  if (project.currentStage === 'ON_PROGRESS' && toStage !== 'ON_PROGRESS') requireValue(['POSITIVE', 'NEGATIVE', 'FIFTY_FIFTY'].includes(project.firstMeetingOutcome), 'Record the first meeting outcome before advancing.');
  if (toStage === 'ACCOUNTS') { requireValue(project.expectedDeliveryDate, 'Expected delivery date is required before moving to Accounts.'); requireValue(project.invoiceAmount > 0, 'Invoice amount is required before moving to Accounts.'); }
  if (project.currentStage === 'ACCOUNTS' && toStage === 'INSTALLATION') requireValue(projectView(project).pendingAmount === 0, 'Full payment is required before moving to Installation.');
  if (toStage === 'COMPLETED') requireValue(project.installationStatus === 'WORK_DONE' && projectView(project).pendingAmount === 0, 'Full payment and completed installation are required.');
  project.previousStage = project.currentStage; project.currentStage = toStage; project.stageChangeTimestamp = now(); project.stageChangedBy = me.email;
  project.onboarded = ['ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED'].includes(toStage);
  project.currentOwnerRole = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW'].includes(toStage) ? 'ROLE_EXECUTIVE' : ['ONBOARDED', 'SALES'].includes(toStage) ? 'ROLE_SALES_COORDINATOR' : toStage === 'ACCOUNTS' ? 'ROLE_ACCOUNTS' : 'ROLE_INSTALLATION';
  if (toStage === 'ONBOARDED' || toStage === 'SALES') project.salesEntryDate ||= today();
  if (toStage === 'ACCOUNTS') { project.salesCompletedAt = now(); project.accountsEntryDate = today(); }
  if (toStage === 'INSTALLATION') { project.accountsCompletedAt = now(); project.installationEntryDate = today(); }
  if (toStage === 'COMPLETED') { project.completionDate ||= today(); project.installationCompletedAt = now(); }
}

const NOT_HANDLED = Symbol('not handled');
const auditGroups: Record<string, string[]> = {
  LOGIN_ACTIVITY: ['USER LOGIN', 'GOOGLE LOGIN'], PROJECT_VISITING_ACTIVITY: ['PROJECT CREATED', 'VISIT SCHEDULED'],
  PROJECT_ACTIVITY: ['PROJECT MOVED', 'PROJECT UPDATED', 'SALES DATA UPDATED', 'INSTALLATION DATA UPDATED', 'PROJECT FEEDBACK UPDATED'],
  PROJECT_COMPLETION: ['PROJECT COMPLETED'], PAYMENT_ACTIVITY: ['PAYMENT RECORDED', 'INVOICE AMOUNT UPDATED'],
  DELETION_ACTIVITY: ['DELETION REQUESTED', 'DELETION APPROVED', 'DELETION REJECTED'], PASSWORD_RESET_ACTIVITY: ['PASSWORD_RESET_REQUESTED', 'PASSWORD RESET REQUEST', 'PASSWORD_CHANGED', 'PASSWORD CHANGED'],
};
function readRoute(state: DemoState, path: string, query: URLSearchParams): unknown {
  const role = query.get('role') || 'EXECUTIVE';
  const projects = filteredProjects(state, query, role).filter(ownsProject), completed = projects.filter(project => project.currentStage === 'COMPLETED');
  const reportProjects = projects.filter(project => !query.get('from') && !query.get('to') || inRange(project.createdDate, query.get('from'), query.get('to')));
  let match: RegExpMatchArray;
  if (path === '/auth/me') return actor(state);
  if (path === '/users/all' || path === '/users/directory') {
    return state.users.filter(user => matches(user.zone ?? undefined, query.get('zone')) && (!query.get('roles') || query.get('roles')!.split(',').includes(user.role))).map(user => ({ ...user,
      executiveOnboardedCount: projects.filter(project => project.createdBy === user.email && project.onboarded).length,
      salesToAccountsCount: projects.filter(project => project.salesUserEmail === user.email && project.salesCompletedAt).length,
      accountsToInstallationCount: projects.filter(project => project.accountsUserEmail === user.email && project.accountsCompletedAt).length,
      installationDoneCount: projects.filter(project => project.installationUserEmail === user.email && project.installationStatus === 'WORK_DONE').length,
    }));
  }
  if (path === '/projects/creation-limit-status') return { creationBlocked: false, projectLimitReached: false, pipelineLimitReached: false };
  if (path === '/projects/all' || path === '/projects/executive') return projects;
  if (path === '/projects/executive/paged') return page(projects, query);
  if (path === '/projects/dashboard') return dashboardProjects(state, query, role);
  if (path === '/projects/dashboard/count') return dashboardProjects(state, query, role).length;
  if (path === '/projects/dashboard/completed/paged') return page(dashboardProjects(state, query, role).filter(project => project.viewBucket === 'DONE'), query);
  if (path === '/projects/dashboard/badge-counts' || path === '/projects/dashboard/badge-counts/admin') {
    const rows = projects.filter(project => project.currentStage !== 'DROPPED');
    return { onboardedCount: rows.filter(project => bucket(project, role) === 'UPCOMING').length, activeCount: rows.filter(project => bucket(project, role) === 'ACTIVE').length, completedCount: rows.filter(project => bucket(project, role) === 'DONE').length };
  }
  if (path === '/projects/sales') return projects.filter(project => ['ONBOARDED', 'SALES'].includes(project.currentStage));
  if (path === '/projects/accounts') return projects.filter(project => project.currentStage === 'ACCOUNTS');
  if (path === '/projects/installation') return projects.filter(project => query.get('status') === 'UPCOMING' ? project.currentStage === 'ACCOUNTS' && project.installationStatus !== 'WORK_DONE' : query.get('status') === 'WORK_DONE' || query.get('status') === 'DONE' ? project.installationStatus === 'WORK_DONE' : project.currentStage === 'INSTALLATION');
  if (path === '/projects/completed/paged' || path === '/projects/completed/archive/filter') return page(completed, query);
  if (path === '/projects/completed/archive/export') { const months = Math.max(1, Math.min(12, Number(query.get('months')) || 1)); const start = new Date(); start.setMonth(start.getMonth() - months); return completed.filter(project => !project.completionDate || project.completionDate >= start.toISOString().slice(0, 10)); }
  if (path === '/projects/completed/count') return completed.length;
  if (path === '/projects/completed/archive/badge-counts') return { completed: completed.length, requests: projects.filter(project => project.deletionRequestStatus === 'PENDING').length, dropped: projects.filter(project => project.currentStage === 'DROPPED').length };
  if (path === '/projects/completed/metrics') { const data = analytics(state, projects, query); return { totalProjects: completed.length, totalValue: sum(completed, project => project.projectValue), totalInvoiceAmount: sum(completed, project => project.invoiceAmount), monthlyCompletedCount: data.completedThisMonth, currentMonthProjects: data.completedThisMonth, averageCompletionDays: data.averageCompletionDays, averageDuration: data.averageCompletionDays }; }
  if (path === '/projects/feedback/queue') return page(completed.filter(project => !project.feedbackCollected), query);
  if (path === '/projects/deletion-requests') return projects.filter(project => project.deletionRequestStatus !== 'NONE' && project.deletionRequestStatus && matches(project.deletionRequestStatus, query.get('status')));
  if (path === '/projects/dropped') return projects.filter(project => project.currentStage === 'DROPPED');
  if ((match = path.match(/^\/projects\/stage\/([A-Z_]+)$/))) { requireValue(stages.includes(match[1] as ProjectStage), 'Unknown project stage.'); return projects.filter(project => project.currentStage === match[1]); }
  if ((match = path.match(/^\/projects\/(\d+)$/))) return projectView(requireOwner(projectById(state, Number(match[1]))));
  if ((match = path.match(/^\/projects\/(\d+)\/visits$/))) { requireOwner(projectById(state, Number(match[1]))); return state.visits.filter(visit => visit.projectId === Number(match[1])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  if (path === '/school-visits') return state.visits.filter(visit => (me.role !== 'ROLE_EXECUTIVE' || visit.assignedTo === me.email) && matches(visit.assignedTo, query.get('assignedTo')) && (!query.get('date') || visit.scheduledFor.slice(0, 10) === query.get('date')) && inRange(visit.scheduledFor, query.get('from'), query.get('to')));
  if (['/analytics/dashboard', '/analytics/stage-distribution', '/analytics/monthly-trends', '/analytics/financial-summary'].includes(path)) { const data = analytics(state, projects, query); return path === '/analytics/dashboard' ? data : path.endsWith('stage-distribution') ? data.stageDistribution : path.endsWith('monthly-trends') ? data.monthlyTrends : data.financialSummary; }
  if (path === '/reports' || path === '/reports/projects/tracking') return reportRows(state, reportProjects);
  if (path === '/reports/projects/tracking/page-data') return page(reportRows(state, reportProjects), query, false);
  if (path === '/reports/executive-activity') {
    const row = (project: Project, activityDate: string) => ({ activityDate, projectId: project.id, executiveName: state.users.find(user => user.email === project.createdBy)?.name || 'Demo User', school: project.school, projectWork: project.projectName });
    return { from: query.get('from') || '', to: query.get('to') || today(), projectsCreated: reportProjects.map(project => row(project, project.createdDate)), schoolVisits: state.visits.filter(visit => visit.status === 'VISITED' && inRange(visit.outcomeRecordedAt || visit.scheduledFor, query.get('from'), query.get('to')) && projects.some(project => project.id === visit.projectId)).map(visit => row(projectById(state, visit.projectId), visit.outcomeRecordedAt || visit.scheduledFor)) };
  }
  if (path === '/reports/payments/aging') return reportProjects.filter(project => project.pendingAmount > 0).map(project => { const agingDays = Math.max(0, Math.floor((Date.parse(today()) - Date.parse(project.accountsEntryDate || project.createdDate)) / 86400000)); return { projectId: project.id, customerName: project.school, projectName: project.projectName, pendingAmount: project.pendingAmount, agingDays, agingBucket: agingDays <= 30 ? '0-30' : agingDays <= 60 ? '31-60' : agingDays <= 90 ? '61-90' : '90+', statusColor: color(project) }; }).filter(row => matches(row.agingBucket, query.get('bucket')));
  if (path === '/reports/sales/pending-count') { const rows = reportProjects.filter(project => ['ONBOARDED', 'SALES'].includes(project.currentStage)); return { totalSalesProjects: rows.length, pendingDeliveryCount: rows.filter(project => !project.expectedDeliveryDate || project.expectedDeliveryDate < today()).length }; }
  if (path === '/reports/admin/employee-status') return state.users.filter(user => matches(user.zone ?? undefined, query.get('zone')) && (!query.get('userId') || user.id === Number(query.get('userId')))).map(user => { const rows = projects.filter(project => [project.createdBy, project.salesUserEmail, project.accountsUserEmail, project.installationUserEmail].includes(user.email)); return { employeeId: user.id, employeeName: user.name, employeeEmail: user.email, role: user.role, zone: user.zone, executiveProjects: rows.filter(project => project.createdBy === user.email).length, salesProjects: rows.filter(project => project.salesUserEmail === user.email).length, accountsProjects: rows.filter(project => project.accountsUserEmail === user.email).length, redProjects: rows.filter(project => color(project) === 'RED').length, yellowProjects: rows.filter(project => color(project) === 'YELLOW').length, greenProjects: rows.filter(project => color(project) === 'GREEN').length, executiveFollowUpDueCount: rows.filter(project => project.nextContact === today()).length, executiveFollowUpOverdueCount: rows.filter(project => project.nextContact && project.nextContact < today()).length }; });
  if (['/tracking/executive', '/tracking/role-based', '/tracking/user-tracking-data'].includes(path)) {
    if (query.get('userId') || query.get('executiveId')) userById(state, Number(query.get('userId') || query.get('executiveId')));
    const tracked = trackedProjects(state, query), rows = tracked.projects;
    if (path === '/tracking/user-tracking-data') return trackingData(rows, tracked.role);
    if (path === '/tracking/executive') return { leads: rows.filter(project => !project.onboarded && project.currentStage !== 'DROPPED').length, onboarded: rows.filter(project => project.onboarded).length, completed: rows.filter(project => project.currentStage === 'COMPLETED').length, dropped: rows.filter(project => project.currentStage === 'DROPPED').length, dueProjects: trackingProjects(rows.filter(project => project.nextContact && project.nextContact <= today() && !project.onboarded)), nonOnboardedProjects: trackingProjects(rows.filter(project => !project.onboarded && project.currentStage !== 'DROPPED')), onboardedProjects: trackingProjects(rows.filter(project => project.onboarded)) };
    const data = trackingData(rows, tracked.role); const selected = (key: string) => trackingProjects(rows.filter(project => data.box2Cards.find(card => card.key === key)?.rows.some(row => row.id === project.id)));
    return { role: tracked.role, completed: selected('DONE').length, completedProjects: selected('DONE'), pipelineProjects: [...selected('UPCOMING'), ...selected('ACTIVE')], upcomingProjects: selected('UPCOMING'), activeProjects: selected('ACTIVE') };
  }
  if (path === '/production/products') return state.products;
  if (path === '/production/summary') return productionSummary(state, query);
  if (path === '/production/history') return productionEntries(state, query);
  if (path === '/production/trends') { const entries = productionEntries(state, query); return Array.from({ length: 12 }, (_, index) => ({ month: index + 1, totalQuantity: sum(entries.filter(entry => entry.month === index + 1), entry => entry.quantity) })); }
  if (path === '/activity/me' || (match = path.match(/^\/activity\/statement\/(\d+)$/))) { const id = path === '/activity/me' ? me.id : Number(match[1]); userById(state, id); return activityStatement(state, id, query); }
  if ((match = path.match(/^\/activity\/user\/(\d+)$/))) { userById(state, Number(match[1])); return page(state.activities.filter(activity => activity.userId === Number(match[1]) && inRange(activity.timestamp, query.get('from'), query.get('to'))).reverse(), query, false); }
  if ((match = path.match(/^\/activity\/role\/([^/]+)$/))) return page(state.activities.filter(activity => activity.userRole === decodeURIComponent(match[1]) && inRange(activity.timestamp, query.get('from'), query.get('to'))).reverse(), query, false);
  if ((match = path.match(/^\/activity\/entity\/([A-Z_]+)\/(\d+)$/))) return state.activities.filter(activity => activity.entityType === match[1] && activity.entityId === Number(match[2]) && inRange(activity.timestamp, query.get('from'), query.get('to'))).reverse();
  if (path === '/audit-logs' || path === '/audit-logs/counts') {
    const rows = state.audits.filter(row => matches(row.actor.zone, query.get('zone')) && matches(row.category, query.get('category')) && matches(row.actor.email, query.get('actorEmail')) && inRange(row.timestamp, query.get('fromDate'), query.get('toDate')) && (!query.get('events') || query.get('events')!.split(',').includes(row.event)));
    if (path.endsWith('/counts')) return Object.fromEntries(Object.entries(auditGroups).map(([key, events]) => [key, rows.filter(row => events.includes(row.event)).length]));
    return page(rows.reverse(), query);
  }
  return NOT_HANDLED;
}

function mutateRoute(state: DemoState, method: string, path: string, data: Payload): unknown {
  let match: RegExpMatchArray;
  if (method === 'post' && ['/auth/login', '/auth/google-login', '/auth/register'].includes(path)) fail(403, 'Use the demo login credentials. External authentication and public registration are unavailable in the local demo.');
  if (method === 'post' && path === '/auth/accept-policy') { requireValue(data.accepted === true && text(data.version), 'Accept the policy to continue.'); Object.assign(actor(state), { termsAccepted: true, policyVersion: text(data.version, 100), policyAcceptedAt: now() }); return { success: true, message: 'Policy accepted for this fictional session.', user: actor(state) }; }
  if (method === 'post' && ['/auth/forgot-password', '/auth/password/change/request', '/auth/update-password/request-otp'].includes(path)) {
    const profile = path !== '/auth/forgot-password';
    if (profile) { requireValue(data.currentPassword === 'incial', 'Use the demo current password: incial.'); requireValue(text(data.newPassword).length >= 6 && data.newPassword === data.confirmPassword, 'Enter matching new passwords with at least 6 characters.'); }
    state.authChallenge = { kind: profile ? 'profile' : 'reset', email: me.email, requestedAt: now() };
    log(state, 'ADMIN_USER_ROLE_UPDATED', 'USER', me.id, 'PASSWORD_RESET_REQUESTED', 'Fictional password update requested; no email was sent.', undefined, 'PASSWORD');
    return { success: true, message: 'Demo only: no email is sent. Use the demonstration code 123456. Demo passwords stay incial.' };
  }
  if (method === 'post' && ['/auth/verify-otp', '/auth/change-password', '/auth/password/change/confirm', '/auth/update-password/confirm'].includes(path)) {
    requireValue(state.authChallenge && Date.now() - Date.parse(state.authChallenge.requestedAt) <= 600000, 'Request a new demo code first.');
    requireValue(String(data.otp) === '123456', 'Use the demonstration code 123456.');
    if (path !== '/auth/verify-otp') { requireValue(text(data.newPassword).length >= 6, 'New password must contain at least 6 characters.'); delete state.authChallenge; log(state, 'ADMIN_USER_ROLE_UPDATED', 'USER', me.id, 'PASSWORD_CHANGED', 'Fictional password update simulated; demo credentials unchanged.', undefined, 'PASSWORD'); }
    return { success: true, message: path === '/auth/verify-otp' ? 'Demo code verified locally.' : 'Password update simulated. Demo passwords stay incial.' };
  }
  if (method === 'patch' && path === '/users/update-name') { requireValue(text(data.name).length >= 2, 'Enter a name with at least 2 characters.'); actor(state).name = text(data.name, 100); return actor(state); }
  if ((method === 'post' && path === '/users/create') || (method === 'put' && (match = path.match(/^\/users\/update\/(\d+)$/)))) {
    const existing = path === '/users/create' ? undefined : userById(state, Number(match[1]));
    if (existing?.id !== me.id) allow();
    if (existing && isLoginAccount(existing.id) && existing.id !== me.id) fail(403, 'Demo login accounts cannot be edited by other users.');
    if (existing && existing.id === me.id) { if (data.name !== undefined) { requireValue(text(data.name), 'Name is required.'); existing.name = text(data.name, 100); } return existing; }
    const email = text(data.email ?? existing?.email, 200).toLowerCase();
    requireValue(fictionalEmail(email) && !email.endsWith('@demo.in'), 'Use a fictional email ending in .example, such as name@staff.example.');
    requireValue(!state.users.some(user => user.email === email && user.id !== existing?.id), 'A fictional user with that email already exists.');
    const role = String(data.role ?? existing?.role) as UserRole;
    requireValue(roles.includes(role), 'Choose a supported staff role.'); requireValue(text(data.name ?? existing?.name), 'Name is required.');
    const user = existing ?? { id: nextId(state.users), name: '', email, role, createdAt: now() };
    assignFields(user, data, ['name', 'zone']); user.email = email; user.role = role; user.lastUpdatedAt = now(); user.lastUpdatedBy = me.email;
    if (!existing) state.users.push(user);
    log(state, 'ADMIN_USER_ROLE_UPDATED', 'USER', user.id, 'PROJECT UPDATED', 'Fictional staff details updated.');
    return user;
  }
  if (method === 'delete' && (match = path.match(/^\/users\/delete\/(\d+)$/))) { allow(); const user = userById(state, Number(match[1])); if (isLoginAccount(user.id)) fail(403, 'Demo login accounts cannot be deleted.'); state.users = state.users.filter(item => item.id !== user.id); log(state, 'ADMIN_USER_ROLE_UPDATED', 'USER', user.id, 'DELETION APPROVED', 'Fictional staff account removed.'); return undefined; }
  if (method === 'post' && path === '/projects/create') {
    allow('ROLE_EXECUTIVE');
    requireValue(state.projects.length < 500, 'Reset the demo before adding more fictional projects.'); requireValue(text(data.school), 'Customer name is required.');
    const project: Project = { id: nextId(state.projects), school: text(data.school), currentStage: 'LEAD', createdBy: me.email, createdDate: today(), zone: me.zone ?? 'ZONE_1', paymentHistory: [], deletionRequestStatus: 'NONE' };
    assignFields(project, data, projectBaseFields); if (me.role === 'ROLE_EXECUTIVE' && me.zone) project.zone = me.zone; state.projects.push(project); log(state, 'EXECUTIVE_LEAD_CREATED', 'PROJECT', project.id, 'PROJECT CREATED', 'Fictional project created.', project); return projectView(project);
  }
  if ((match = path.match(/^\/projects\/(\d+)(?:\/(additional-data|transition|sales|ready-for-accounts|accounts|installation|feedback|deletion-request|deletion-request\/review|visits))?$/))) {
    const project = projectById(state, Number(match[1])), action = match[2];
    if (method === 'delete' && !action) allow();
    else if (action === 'deletion-request') allow('ROLE_EXECUTIVE', 'ROLE_SALES_COORDINATOR', 'ROLE_ACCOUNTS', 'ROLE_INSTALLATION');
    else if (action === 'deletion-request/review') allow();
    else if (action === 'sales' || action === 'ready-for-accounts') allow('ROLE_SALES_COORDINATOR');
    else if (action === 'accounts') allow('ROLE_ACCOUNTS');
    else if (action === 'installation') allow('ROLE_INSTALLATION');
    else if (action === 'feedback') allow('ROLE_FEEDBACK');
    else allow('ROLE_EXECUTIVE');
    requireOwner(project);
    if (method === 'delete' && !action) { state.projects = state.projects.filter(item => item.id !== project.id); state.visits = state.visits.filter(visit => visit.projectId !== project.id); log(state, 'EXECUTIVE_PROJECT_DELETED', 'PROJECT', project.id, 'DELETION APPROVED', 'Fictional project deleted.', project); return undefined; }
    if (method === 'post' && action === 'visits') {
      requireValue(text(data.executiveRemark), 'Executive remark is required.'); const scheduledFor = date(data.scheduledFor, 'Visit date');
      const assignedTo = me.role === 'ROLE_EXECUTIVE' ? me.email : text(data.assignedTo || project.createdBy); requireValue(state.users.some(user => user.email === assignedTo && (user.role === 'ROLE_EXECUTIVE' || user.role === 'ROLE_DEMO')), 'Choose a fictional executive.');
      const visit = { id: nextId(state.visits), projectId: project.id, school: project.school, projectName: project.projectName, scheduledFor, assignedTo, scheduledBy: me.email, executiveRemark: text(data.executiveRemark), status: 'SCHEDULED' as const, createdAt: now() };
      state.visits.push(visit); project.lastContact = today(); project.lastVisitDate = today(); project.executiveRemarks = visit.executiveRemark;
      if (data.nextContact) project.nextContact = date(data.nextContact, 'Next contact date');
      log(state, 'EXECUTIVE_PROJECT_UPDATED', 'PROJECT', project.id, 'VISIT SCHEDULED', 'Fictional site visit scheduled.', project); return visit;
    }
    let actionType: ActivityActionType = 'EXECUTIVE_PROJECT_UPDATED', event = 'PROJECT UPDATED';
    if (method === 'put' && !action) { if (data.school !== undefined) requireValue(text(data.school), 'Customer name is required.'); assignFields(project, data, projectBaseFields); }
    else if (method === 'patch' && action === 'additional-data') { assignFields(project, data, ['brc', 'projectCategory', 'projectType', 'enquiryType', 'needHelp', 'salesOfficeRemark']); project.salesOffice = project.needHelp === 'SALES_OFFICE'; project.salesHead = project.needHelp === 'SALES_HEAD'; }
    else if (method === 'post' && action === 'transition') { changeStage(project, data.toStage as ProjectStage); actionType = 'EXECUTIVE_STAGE_ADVANCED'; event = project.currentStage === 'COMPLETED' ? 'PROJECT COMPLETED' : 'PROJECT MOVED'; }
    else if (method === 'put' && action === 'sales') {
      requireValue(['ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION'].includes(project.currentStage), 'Sales details require an onboarded project.');
      assignFields(project, data, ['invoiceAmount', 'quotationRemarks', 'expectedDeliveryDate', 'salesRemarks', 'installationTaskList', 'projectClassification']);
      requireValue((project.invoiceAmount ?? 0) >= projectView(project).totalReceived, 'Invoice amount cannot be less than the amount received.'); project.projectValue ??= project.invoiceAmount;
      project.salesUserEmail ||= me.email; project.salesUpdatedTimestamp = now(); if (project.currentStage === 'ONBOARDED') changeStage(project, 'SALES'); actionType = 'SALES_DETAILS_UPDATED'; event = 'SALES DATA UPDATED';
    }
    else if (method === 'post' && action === 'ready-for-accounts') { changeStage(project, 'ACCOUNTS'); actionType = 'SALES_DETAILS_UPDATED'; event = 'PROJECT MOVED'; }
    else if (method === 'put' && action === 'accounts') {
      requireValue(['SALES', 'ACCOUNTS', 'INSTALLATION'].includes(project.currentStage), 'Accounts details require a sales, accounts or installation project.');
      assignFields(project, data, ['invoiceAmount', 'paymentDate', 'paymentRemarks']); const before = projectView(project), amount = data.amountReceived === undefined ? 0 : numeric(data.amountReceived, 'Payment amount');
      requireValue(before.totalReceived + amount <= (project.invoiceAmount ?? 0), 'Payment cannot exceed the pending invoice amount.');
      if (amount > 0) { requireValue(project.paymentDate, 'Payment date is required.'); project.paymentHistory ||= []; project.paymentHistory.push({ id: nextId(project.paymentHistory), projectId: project.id, amountPaid: amount, paymentDate: project.paymentDate, remarks: project.paymentRemarks, createdAt: now(), createdBy: me.email }); }
      Object.assign(project, projectView(project)); project.accountsUserEmail ||= me.email; project.accountsUpdatedTimestamp = now(); project.accountsEntryDate ||= today();
      if (project.pendingAmount === 0 && project.invoiceAmount > 0) changeStage(project, project.installationStatus === 'WORK_DONE' ? 'COMPLETED' : 'INSTALLATION');
      actionType = 'ACCOUNTS_PAYMENT_RECORDED'; event = amount > 0 ? 'PAYMENT RECORDED' : 'INVOICE AMOUNT UPDATED';
    }
    else if (method === 'put' && action === 'installation') {
      requireValue(['ACCOUNTS', 'INSTALLATION'].includes(project.currentStage), 'Installation details require an accounts or installation project.');
      if (data.installationStatus !== undefined) requireValue(['PENDING', 'WORK_DONE', 'NOT_DONE'].includes(String(data.installationStatus)), 'Choose a valid installation status.');
      assignFields(project, data, ['installationStatus', 'installationRemarks', 'completionDate']); if (project.installationStatus === 'WORK_DONE') requireValue(project.completionDate, 'Completion date is required.');
      project.installationUserEmail ||= me.email; project.installationUpdatedTimestamp = now(); project.installationEntryDate ||= today();
      event = 'INSTALLATION DATA UPDATED';
      if (project.installationStatus === 'WORK_DONE') { project.installationCompletedAt = now(); if (projectView(project).pendingAmount === 0 && project.invoiceAmount > 0) { changeStage(project, 'COMPLETED'); event = 'PROJECT COMPLETED'; } actionType = 'INSTALLATION_COMPLETED'; } else actionType = 'INSTALLATION_STATUS_UPDATED';
    }
    else if (method === 'patch' && action === 'feedback') { requireValue(project.currentStage === 'COMPLETED' && typeof data.feedbackCollected === 'boolean', 'Feedback requires a completed project.'); project.feedbackCollected = data.feedbackCollected as boolean; project.feedbackUpdatedAt = now(); project.feedbackUpdatedBy = me.email; event = 'PROJECT FEEDBACK UPDATED'; }
    else if (method === 'post' && action === 'deletion-request') { requireValue(project.deletionRequestStatus !== 'PENDING', 'A deletion request is already pending.'); requireValue(text(data.reason), 'Enter a deletion reason.'); Object.assign(project, { deletionRequestStatus: 'PENDING', deletionRequestReason: text(data.reason), deletionRequestedBy: me.email, deletionRequestedByRole: 'ROLE_DEMO', deletionRequestedAt: now(), deletionRequestedFromStage: project.currentStage }); event = 'DELETION REQUESTED'; }
    else if (method === 'post' && action === 'deletion-request/review') { requireValue(project.deletionRequestStatus === 'PENDING' && typeof data.approve === 'boolean', 'No pending deletion request to review.'); Object.assign(project, { deletionRequestStatus: data.approve ? 'APPROVED' : 'REJECTED', deletionReviewedBy: me.email, deletionReviewedByRole: 'ROLE_DEMO', deletionReviewRemarks: text(data.remarks), deletionReviewedAt: now() }); if (data.approve) changeStage(project, 'DROPPED'); event = data.approve ? 'DELETION APPROVED' : 'DELETION REJECTED'; }
    else return NOT_HANDLED;
    project.lastUpdatedAt = now(); project.lastUpdatedBy = me.email; Object.assign(project, projectView(project)); log(state, actionType, action === 'accounts' ? 'PAYMENT' : action === 'installation' ? 'INSTALLATION' : 'PROJECT', project.id, event, `Fictional ${action || 'project'} updated.`, project); return projectView(project);
  }
  if (method === 'patch' && (match = path.match(/^\/school-visits\/(\d+)\/outcome$/))) {
    allow('ROLE_EXECUTIVE'); const visit = state.visits.find(item => item.id === Number(match[1])) ?? fail(404, 'Fictional visit not found.');
    if (me.role === 'ROLE_EXECUTIVE' && visit.assignedTo !== me.email) fail(403, 'Executives can only record their own visits.');
    requireValue(typeof data.visited === 'boolean', 'Choose a visit outcome.'); if (!data.visited) requireValue(text(data.notVisitedReason), 'Enter a reason for the missed visit.');
    Object.assign(visit, { status: data.visited ? 'VISITED' : 'NOT_VISITED', visitNote: text(data.visitNote), notVisitedReason: data.visited ? undefined : text(data.notVisitedReason), outcomeRecordedAt: now(), outcomeRecordedBy: me.email });
    const project = projectById(state, visit.projectId); if (data.visited) { project.lastVisitDate = today(); project.lastContact = today(); }
    log(state, 'EXECUTIVE_PROJECT_UPDATED', 'PROJECT', project.id, 'PROJECT UPDATED', 'Fictional site visit outcome recorded.', project); return visit;
  }
  if (method === 'post' && path === '/production/products') { allow('ROLE_PRODUCTION'); requireValue(text(data.name) && text(data.category), 'Product name and category are required.'); requireValue(!state.products.some(product => product.name.toLowerCase() === text(data.name).toLowerCase()), 'A fictional product with this name already exists.'); const product = { id: nextId(state.products), name: text(data.name, 100), category: text(data.category, 100), status: 'ACTIVE' }; state.products.push(product); log(state, 'PRODUCTION_PRODUCT_ADDED', 'PRODUCTION_PRODUCT', product.id, 'PROJECT UPDATED', 'Fictional product added.'); return product; }
  if (method === 'put' && path === '/production/summary') {
    allow('ROLE_PRODUCTION');
    const month = Number(data.month), year = Number(data.year); requireValue(Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 2000 && year <= 2100, 'Choose a valid production month and year.'); requireValue(Array.isArray(data.quantities) && data.quantities.length <= 500, 'Provide bounded product quantities.');
    const quantities = data.quantities as { productId: number; quantity: number }[]; requireValue(new Set(quantities.map(item => item.productId)).size === quantities.length, 'Choose each product only once.');
    quantities.forEach(item => { const product = state.products.find(candidate => candidate.id === Number(item.productId)) ?? fail(404, 'Fictional product not found.'); const quantity = numeric(item.quantity, 'Quantity'); requireValue(Number.isInteger(quantity), 'Production quantity must be a whole number.'); let entry = state.entries.find(candidate => candidate.month === month && candidate.year === year && candidate.productId === product.id); if (!entry) { entry = { entryId: nextId(state.entries), month, year, productId: product.id, productName: product.name, category: product.category, quantity: 0 }; state.entries.push(entry); } Object.assign(entry, { quantity, timestamp: now(), updatedByEmail: me.email, updatedByName: actor(state).name, updatedByRole: me.role, updatedByZone: me.zone ?? 'ZONE_1' }); log(state, 'PRODUCTION_ENTRY_SAVED', 'PRODUCTION_ENTRY', entry.entryId, 'PROJECT UPDATED', `Fictional production quantity updated for ${product.name}.`); });
    return productionSummary(state, new URLSearchParams({ month: String(month), year: String(year) }));
  }
  return NOT_HANDLED;
}

// The signed-out "forgot password" screen is simulated locally as well (code 123456, no email).
const PUBLIC_ROUTES = new Set(['/auth/forgot-password', '/auth/verify-otp', '/auth/change-password']);

/** An entirely local Axios transport. It has no HTTP fallback. */
export const demoAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const response = (data: unknown, status = 200) => ({ data, status, statusText: status < 400 ? 'OK' : 'Demo request rejected', headers: { 'content-type': 'application/json', 'x-workhub-demo': 'local' }, config });
  try {
    config.cancelToken?.throwIfRequested(); if (config.signal?.aborted) throw new CanceledError('Demo request canceled.', config);
    const rawUrl = String(config.url || ''); if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) fail(404, 'External URLs are unavailable in the local demo.');
    const parsed = new URL(rawUrl, 'https://local.example'); const path = parsed.pathname.replace(/\/$/, '') || '/';
    if (!PUBLIC_ROUTES.has(path) && !restoreDemoSession()) fail(401, 'A valid local demo session is required.');
    if (config.params && typeof config.params === 'object') Object.entries(config.params).forEach(([key, value]) => { if (value !== undefined && value !== null) parsed.searchParams.set(key, String(value)); });
    const method = String(config.method || 'get').toLowerCase(), state = readDemoState();
    const sessionUserId = restoreDemoSession()?.user.id ?? DEMO_ACTOR_ID;
    me = state.users.find(user => user.id === sessionUserId) ?? state.users.find(user => user.id === DEMO_ACTOR_ID)!;
    let data: Payload = {};
    if (config.data !== undefined && config.data !== '') { try { data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data; } catch { fail(400, 'Invalid local demo payload.'); } requireValue(data && typeof data === 'object' && !Array.isArray(data), 'Provide an object payload.'); }
    const result = method === 'get' ? readRoute(state, path, parsed.searchParams) : mutateRoute(state, method, path, data);
    if (result === NOT_HANDLED) fail(404, `This endpoint is unavailable in the local demo (${method.toUpperCase()} ${path}).`);
    config.cancelToken?.throwIfRequested(); if (config.signal?.aborted) throw new CanceledError('Demo request canceled.', config);
    if (method !== 'get') writeDemoState(state);
    const direct = path.startsWith('/users/') || path.startsWith('/auth/');
    return response(direct ? result : { success: true, message: 'Fictional local demo data.', data: result });
  } catch (error) {
    if (error instanceof CanceledError) throw error;
    const status = error instanceof DemoError ? error.status : 400;
    const message = error instanceof DemoError ? error.message : 'The fictional demo change could not be saved. Reset the demo and try again.';
    throw new AxiosError(message, status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, undefined, response({ success: false, message, errorCode: 'LOCAL_DEMO_ERROR' }, status));
  }
};
