import type { Analytics, DashboardRole, FinancialSummary, PageResult, ProductionEntry, Project, ProjectTrackingReportRow, ProjectViewBucket, TrackingProjectLite, UserActivityStatement, UserTrackingData } from '../types';
import type { DemoState } from './store';
import { today } from './seed';

export const sum = <T>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + (value(row) || 0), 0);
export const matches = (value: string | undefined, filter: string | null) => !filter || filter === 'ALL' || filter === 'all' || value === filter;
export const inRange = (date: string | undefined, from: string | null, to: string | null) => !!date && (!from || date.slice(0, 10) >= from.slice(0, 10)) && (!to || date.slice(0, 10) <= to.slice(0, 10));
export const contains = (value: unknown, query: string | null) => !query || String(value ?? '').toLowerCase().includes(query.trim().toLowerCase());
export function page<T>(rows: T[], query: URLSearchParams, oneBased = true): PageResult<T> {
  const size = Math.min(200, Math.max(1, Number(query.get('size')) || 10));
  const number = Math.max(0, (Number(query.get('page')) || (oneBased ? 1 : 0)) - (oneBased ? 1 : 0));
  const totalPages = Math.ceil(rows.length / size);
  return { content: rows.slice(number * size, (number + 1) * size), totalElements: rows.length, totalPages, size, number, first: number === 0, last: number >= totalPages - 1 };
}

export function bucket(project: Project, role: string): ProjectViewBucket {
  const stage = project.currentStage;
  if (stage === 'DROPPED') return 'NOT_RELEVANT';
  if (stage === 'COMPLETED') return 'DONE';
  if (role === 'EXECUTIVE') return ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW'].includes(stage) ? 'UPCOMING' : 'ACTIVE';
  const order = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED'];
  const index = order.indexOf(stage), active = role === 'SALES' ? 5 : role === 'ACCOUNTS' ? 6 : 7;
  return index < active - 1 ? 'NOT_RELEVANT' : index === active - 1 ? 'UPCOMING' : index === active ? 'ACTIVE' : 'DONE';
}

export function projectView(project: Project, role = 'EXECUTIVE'): Project {
  const onboarded = ['ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED'].includes(project.currentStage);
  const totalReceived = sum(project.paymentHistory ?? [], payment => payment.amountPaid);
  const invoiceAmount = project.invoiceAmount ?? 0;
  const pendingAmount = Math.max(0, invoiceAmount - totalReceived);
  return { ...project, onboarded, executiveViewStatus: project.currentStage === 'COMPLETED' ? 'COMPLETED' : onboarded ? 'ONBOARDED_ACTIVE' : 'NON_ONBOARDED', viewBucket: bucket(project, role), totalReceived, totalPaidAmount: totalReceived, amountReceived: totalReceived, pendingAmount, paymentStatus: !invoiceAmount ? 'PENDING_INPUT' : pendingAmount === 0 ? 'COMPLETED' : totalReceived ? 'PARTIAL' : 'PENDING' };
}

export function filteredProjects(state: DemoState, query: URLSearchParams, role = 'EXECUTIVE') {
  const executive = state.users.find(user => user.id === Number(query.get('executiveId')));
  const search = query.get('search') || query.get('searchTerm') || query.get('schoolSearch');
  return state.projects.map(project => projectView(project, role)).filter(project => matches(project.zone, query.get('zone'))
    && matches(project.district, query.get('district')) && matches(project.parentCompany, query.get('parentCompany'))
    && (!executive || project.createdBy === executive.email)
    && contains(`${project.school} ${project.projectName ?? ''} ${project.contactPerson ?? ''} ${project.place ?? ''}`, search)
    && (!query.get('statuses') || query.get('statuses')!.split(',').includes(project.executiveViewStatus!))
    && (!query.get('stage') || matches(project.currentStage, query.get('stage'))));
}

export const dashboardProjects = (state: DemoState, query: URLSearchParams, role: string) => filteredProjects(state, query, role).filter(project => project.viewBucket !== 'NOT_RELEVANT' && (!query.get('viewBuckets') || query.get('viewBuckets')!.split(',').includes(project.viewBucket!)));
export const color = (project: Project) => project.pendingAmount === 0 && !!project.invoiceAmount ? 'GREEN' : project.totalReceived ? 'YELLOW' : 'RED';

export function reportRows(state: DemoState, projects: Project[]): ProjectTrackingReportRow[] {
  return projects.map(project => ({ projectId: project.id, customerName: project.school, projectName: project.projectName, stage: project.currentStage, zone: project.zone, projectValue: project.projectValue, invoiceAmount: project.invoiceAmount, pendingAmount: project.pendingAmount, amountReceived: project.totalReceived, paymentStatus: color(project), createdDate: project.createdDate, executiveName: state.users.find(user => user.email === project.createdBy)?.name ?? 'Demo User', executiveEmail: project.createdBy, stageChangedAt: project.stageChangeTimestamp, nextDayFollowUp: project.nextContact, lastContactDate: project.lastContact, lastVisitDate: project.lastVisitDate, brc: project.brc, projectCategory: project.projectCategory, projectType: project.projectType, enquiryType: project.enquiryType, needHelp: project.needHelp, salesOffice: project.salesOffice, salesHead: project.salesHead, salesOfficeRemark: project.salesOfficeRemark, completedDate: project.completionDate, stageChangedBy: project.stageChangedBy, lastUpdatedBy: project.lastUpdatedBy }));
}

export function productionEntries(state: DemoState, query: URLSearchParams): ProductionEntry[] {
  return state.entries.filter(entry => (!query.get('month') || entry.month === Number(query.get('month'))) && (!query.get('year') || entry.year === Number(query.get('year'))) && matches(entry.updatedByZone, query.get('zone')) && entry.quantity >= Number(query.get('minQuantity') || 0)
    && inRange(`${entry.year}-${String(entry.month).padStart(2, '0')}-01`, query.get('from')?.slice(0, 7) ? query.get('from')!.slice(0, 7) + '-01' : null, query.get('to')?.slice(0, 7) ? query.get('to')!.slice(0, 7) + '-31' : null));
}

export function productionSummary(state: DemoState, query: URLSearchParams) {
  const date = new Date(); const month = Number(query.get('month')) || date.getMonth() + 1, year = Number(query.get('year')) || date.getFullYear();
  const period = new URLSearchParams(query); period.set('month', String(month)); period.set('year', String(year));
  const saved = productionEntries(state, period);
  const entries = state.products.filter(product => product.status === 'ACTIVE').map(product => saved.find(entry => entry.productId === product.id) ?? ({ month, year, productId: product.id, productName: product.name, category: product.category, quantity: 0 })).filter(entry => entry.quantity >= Number(query.get('minQuantity') || 0));
  return { month, year, totalQuantity: sum(entries, entry => entry.quantity), entries };
}

export function analytics(state: DemoState, projects: Project[], query: URLSearchParams): Analytics {
  const completed = projects.filter(project => project.currentStage === 'COMPLETED');
  const financialSummary: FinancialSummary = { totalRevenue: sum(projects, project => project.invoiceAmount), completedRevenue: sum(completed, project => project.invoiceAmount), pendingRevenue: sum(projects.filter(project => project.currentStage !== 'COMPLETED'), project => project.invoiceAmount), totalReceived: sum(projects, project => project.totalReceived), totalPending: sum(projects, project => project.pendingAmount) };
  const stages = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED'];
  const stageDistribution = stages.map(stage => { const count = projects.filter(project => project.currentStage === stage).length; return { stage, count, percentage: projects.length ? count / projects.length * 100 : 0 }; });
  const monthlyTrends = Array.from({ length: 6 }, (_, index) => { const period = new Date(); period.setDate(1); period.setMonth(period.getMonth() - 5 + index); const prefix = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}`; const current = projects.filter(project => project.createdDate.startsWith(prefix)); return { month: period.toLocaleString('en', { month: 'short' }), year: period.getFullYear(), projectCount: current.length, revenue: sum(current, project => project.invoiceAmount), completedCount: completed.filter(project => project.completionDate?.startsWith(prefix)).length }; });
  const current = productionSummary(state, query), monthPrefix = today().slice(0, 7);
  const entries = productionEntries(state, query);
  const topProductsThisMonth = Object.fromEntries(current.entries.map(entry => [entry.productName, entry.quantity]));
  const breakdown = (rows: Project[]) => ({ red: rows.filter(project => color(project) === 'RED').length, yellow: rows.filter(project => color(project) === 'YELLOW').length, green: rows.filter(project => color(project) === 'GREEN').length });
  return { totalProjects: projects.length, activeProjects: projects.filter(project => !['COMPLETED', 'DROPPED'].includes(project.currentStage)).length, completedProjects: completed.length, successRate: projects.length ? completed.length / projects.length * 100 : 0, financialSummary, stageDistribution, monthlyTrends,
    projectsThisMonth: projects.filter(project => project.createdDate.startsWith(monthPrefix)).length, completedThisMonth: completed.filter(project => project.completionDate?.startsWith(monthPrefix)).length, revenueThisMonth: sum(projects.filter(project => project.createdDate.startsWith(monthPrefix)), project => project.invoiceAmount), pendingFeedbackProjects: completed.filter(project => !project.feedbackCollected).length, averageCompletionDays: completed.length ? sum(completed, project => Math.max(0, (Date.parse(project.completionDate!) - Date.parse(project.createdDate)) / 86400000)) / completed.length : 0,
    productionSummary: { currentMonthQuantity: current.totalQuantity, yearToDateQuantity: sum(entries.filter(entry => entry.year === new Date().getFullYear()), entry => entry.quantity), monthlyProductionTrend: 0, recentEntries: entries.slice(-8).reverse(), topProductsThisMonth }, statusInsights: { paymentActivity: breakdown(projects), salesUpdation: breakdown(projects.filter(project => ['ONBOARDED', 'SALES'].includes(project.currentStage))), accounts: breakdown(projects.filter(project => project.currentStage === 'ACCOUNTS')), executive: breakdown(projects.filter(project => !project.onboarded)) }, projectCreationLimitStatus: { creationBlocked: false, projectLimitReached: false, pipelineLimitReached: false } };
}

export function trackingProjects(projects: Project[]): TrackingProjectLite[] {
  return projects.map(project => ({ id: project.id, name: project.projectName || project.school, school: project.school, place: project.place, district: project.district, region: project.region, contactPerson: project.contactPerson, contactNumber: project.contactNumber, currentStage: project.currentStage, onboarded: project.onboarded, installationStatus: project.installationStatus, pendingAmount: project.pendingAmount, nextFollowupDate: project.nextContact, createdDate: project.createdDate, stageEntryDate: project.stageChangeTimestamp, onboardedDate: project.salesEntryDate, completedAt: project.completionDate, completedBy: project.installationUserEmail, color: color(project), executiveRemarks: project.executiveRemarks, firstMeetingOutcome: project.firstMeetingOutcome }));
}

export function trackedProjects(state: DemoState, query: URLSearchParams) {
  const id = Number(query.get('executiveId') || query.get('userId'));
  const user = state.users.find(item => item.id === id);
  const role = query.get('role') || user?.role || 'ROLE_EXECUTIVE';
  const projects = filteredProjects(state, query).filter(project => {
    if (!user) return true;
    if (role.includes('EXECUTIVE')) return project.createdBy === user.email;
    if (role.includes('SALES')) return project.salesUserEmail === user.email;
    if (role.includes('ACCOUNTS')) return project.accountsUserEmail === user.email;
    if (role.includes('INSTALLATION')) return project.installationUserEmail === user.email;
    return project.createdBy === user.email || project.lastUpdatedBy === user.email;
  }).filter(project => !query.get('from') && !query.get('to') || inRange(project.createdDate, query.get('from'), query.get('to')));
  return { projects, role, user };
}

export function trackingData(projects: Project[], role: string): UserTrackingData {
  const normalizedRole: DashboardRole = role.includes('SALES') ? 'SALES' : role.includes('ACCOUNTS') ? 'ACCOUNTS' : role.includes('INSTALLATION') ? 'INSTALLATION' : 'EXECUTIVE';
  const projectTableRows = projects.map(project => ({ ...project, dueDate: project.nextContact, stageEntryDate: project.stageChangeTimestamp, completedAt: project.completionDate, statusColor: color(project), daysOverdue: project.nextContact ? Math.max(0, Math.floor((Date.parse(today()) - Date.parse(project.nextContact)) / 86400000)) : 0 }));
  const cards = (['UPCOMING', 'ACTIVE', 'DONE'] as const).map(key => { const rows = projectTableRows.filter(project => bucket(project, normalizedRole) === key); return { key, label: key === 'DONE' ? 'Completed Projects' : key === 'UPCOMING' ? 'Upcoming Projects' : 'Active Projects', count: rows.length, rows }; });
  return { box1Metrics: [ { label: 'Leads (Not Onboarded)', value: projects.filter(project => !project.onboarded && project.currentStage !== 'DROPPED').length }, { label: 'Onboarded Projects', value: projects.filter(project => project.onboarded).length }, { label: 'Completed Projects', value: cards[2].count }, { label: 'Dropped Projects', value: projects.filter(project => project.currentStage === 'DROPPED').length } ], box2Cards: cards, statusSummaryCards: ['RED', 'YELLOW', 'GREEN'].map(key => { const rows = projectTableRows.filter(project => project.statusColor === key); return { key, label: key, count: rows.length, rows }; }), projectTableRows };
}

export function activityStatement(state: DemoState, id: number, query: URLSearchParams): UserActivityStatement {
  const user = state.users.find(item => item.id === id)!;
  const activityTimeline = state.activities.filter(activity => activity.userId === id && inRange(activity.timestamp, query.get('from'), query.get('to'))).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const actionBreakdown: Record<string, number> = {};
  activityTimeline.forEach(activity => { actionBreakdown[activity.actionType] = (actionBreakdown[activity.actionType] || 0) + 1; });
  return { userId: id, userName: user.name, role: user.role, from: query.get('from') || '', to: query.get('to') || today(), totalActions: activityTimeline.length, actionBreakdown, roleContributions: { projectsCreated: actionBreakdown.EXECUTIVE_LEAD_CREATED || 0, paymentsRecorded: actionBreakdown.ACCOUNTS_PAYMENT_RECORDED || 0, installationCompleted: actionBreakdown.INSTALLATION_COMPLETED || 0 }, activityTimeline };
}
