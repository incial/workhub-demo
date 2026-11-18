import type { AuditLogRow, PaymentTransaction, ProductionEntry, ProductionProduct, Project, ProjectStage, SchoolVisit, User, UserActivityLog, UserRole, Zone } from '../types';
import type { DemoState } from './store';
import { DEMO_ACCOUNTS } from './session';
import { KERALA_DISTRICTS } from '../constants/kerala-districts';
import { PARENT_COMPANY_OPTIONS, PRODUCTION_CATEGORY_OPTIONS } from '../constants/dropdown-options';

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString();
export const dateOffset = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const at = (day: string, time = '10:00:00') => `${day}T${time}Z`;
const daysAfter = (day: string, days: number) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); const result = date.toISOString().slice(0, 10); return result > today() ? today() : result; };

const staffRoles: UserRole[] = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_EXECUTIVE', 'ROLE_SALES_COORDINATOR', 'ROLE_ACCOUNTS', 'ROLE_INSTALLATION', 'ROLE_PRODUCTION', 'ROLE_ZONAL_MANAGER', 'ROLE_FEEDBACK', 'ROLE_EMPLOYEE', 'ROLE_CLIENT'];
const zones: Zone[] = ['ZONE_1', 'ZONE_2', 'ZONE_3'];
const zoneAt = (index: number): Zone => zones[index % 3];

/** Every zone gets the same pipeline, so each executive, Billing and Accounts have work at every step. */
const STAGE_PLAN: ProjectStage[] = ['LEAD', 'LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'SALES', 'ACCOUNTS', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED'];
const STEP_DAYS = 8;
const ACCOUNTS_AGES = [4, 15, 6, 25, 12, 3];
const ORDER: ProjectStage[] = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED'];
const WORKS = ['Outdoor Play Area', 'Smart Classroom Setup', 'Science Lab Upgrade', 'Art and Craft Studio', 'Fitness Zone', 'Reading Corner', 'Activity Hall Furniture'];
const PROJECT_TYPES: Project['projectType'][] = ['STAR', 'COMMON', 'ART_AND_CRAFTS', 'SYSTEMATICS'];
const ENQUIRIES: Project['enquiryType'][] = ['OUTDOOR', 'INDOOR', 'FURNITURE', 'LAB_ART_WORK'];
const OUTCOMES: NonNullable<Project['firstMeetingOutcome']>[] = ['POSITIVE', 'FIFTY_FIFTY', 'POSITIVE', 'NEGATIVE'];
const PRODUCTS = ['Workhub Demo Swing Set', 'Workhub Demo Fitness Station', 'Workhub Demo Classroom Shelving', 'Workhub Demo Shade Structure', 'Workhub Demo Activity Table', 'Workhub Demo Climbing Frame'];

/**
 * Starting data for the showcase: every role, login account and staff user,
 * a "Workhub Demo Project" pipeline covering every workflow stage, and a
 * procurement catalogue with six months of quantities. Pass
 * `{ sampleProjects: false }` for users only.
 */
export function createDemoSeed({ sampleProjects = true }: { sampleProjects?: boolean } = {}): DemoState {
  const users: User[] = [{ id: 9001, name: 'Demo User', email: 'incial@demo.in', role: 'ROLE_DEMO', termsAccepted: true, createdAt: dateOffset(-180) }];
  for (let zone = 0; zone < 3; zone++) for (const [index, role] of staffRoles.entries()) {
    const id = 9100 + zone * 20 + index;
    const account = DEMO_ACCOUNTS.find(item => item.id === id);
    const key = role === 'ROLE_PRODUCTION' ? 'procurement' : role.replace('ROLE_', '').toLowerCase();
    const title = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    users.push(account
      ? { id, name: account.name, email: account.email, role, ...(account.zone ? { zone: account.zone } : {}), termsAccepted: true, createdAt: dateOffset(-180) }
      : { id, name: `Demo ${title} ${zone + 1}`, email: `${key}${zone + 1}@staff.example`, role, zone: zoneAt(zone), termsAccepted: true, createdAt: dateOffset(-180) });
  }
  /** The seeded staff member for a role in a zone (zone 1 staff are the login accounts). */
  const staff = (role: UserRole, zone: number) => users.find(user => user.id === 9100 + zone * 20 + staffRoles.indexOf(role))!;
  if (!sampleProjects) {
    return { version: 1, provenance: 'workhub-demo-fictional-v1', users, projects: [], products: [], visits: [], entries: [], activities: [], audits: [] };
  }

  const projects: Project[] = [];
  const visits: SchoolVisit[] = [];
  const activities: UserActivityLog[] = [];
  const audits: AuditLogRow[] = [];
  const track = (user: User, actionType: UserActivityLog['actionType'], entityType: UserActivityLog['entityType'], project: Project, timestamp: string, event: string, description: string, category: AuditLogRow['category'] = 'PROJECT') => {
    activities.push({ id: 16001 + activities.length, userId: user.id, userRole: user.role, actionType, entityType, entityId: project.id, timestamp, metadata: { description, school: project.school, projectName: project.projectName, zone: project.zone } });
    audits.push({ id: 17001 + audits.length, event, description, projectName: project.projectName, amountReceived: project.amountReceived, pendingAmount: project.pendingAmount, actor: { name: user.name, email: user.email, role: user.role, zone: user.zone ?? project.zone }, category, timestamp });
  };

  for (let zone = 0; zone < 3; zone++) STAGE_PLAN.forEach((currentStage, slot) => {
    const index = zone * STAGE_PLAN.length + slot;
    const number = String(index + 1).padStart(2, '0');
    const step = ORDER.indexOf(currentStage);
    const dropped = currentStage === 'DROPPED';
    const onboarded = step >= 4;
    const executive = staff('ROLE_EXECUTIVE', zone), sales = staff('ROLE_SALES_COORDINATOR', zone), accounts = staff('ROLE_ACCOUNTS', zone), installation = staff('ROLE_INSTALLATION', zone);
    // Each project entered its current stage recently (Accounts ages spread over green / yellow / red);
    // earlier milestones are eight days apart going back from there.
    const stageAge = currentStage === 'ACCOUNTS' ? ACCOUNTS_AGES[zone * 2 + (slot - 8)] : 1 + ((slot * 3 + zone * 2) % 11);
    const stageEntered = dateOffset(-stageAge);
    const createdDate = daysAfter(stageEntered, -(dropped ? 20 : step * STEP_DAYS));
    const milestone = (stepIndex: number) => daysAfter(createdDate, stepIndex * STEP_DAYS);
    const district = KERALA_DISTRICTS[(zone * 5 + slot) % KERALA_DISTRICTS.length];
    const projectValue = 120000 + ((index * 37) % 18) * 15000;
    const invoiceAmount = onboarded ? projectValue + 10000 : undefined;
    const id = 10001 + index;
    const work = WORKS[index % WORKS.length];

    const payments: PaymentTransaction[] = [];
    if (invoiceAmount) {
      const firstHalf = Math.round(invoiceAmount / 2);
      const salesDone = milestone(6);
      if (currentStage === 'ACCOUNTS' && slot === 9) payments.push({ id: 15000 + index * 2, projectId: id, amountPaid: firstHalf, paymentDate: daysAfter(salesDone, 2), remarks: 'Advance received for Workhub Demo Project.', createdAt: at(daysAfter(salesDone, 2)), createdBy: accounts.email });
      if (currentStage === 'INSTALLATION' || currentStage === 'COMPLETED') {
        payments.push({ id: 15000 + index * 2, projectId: id, amountPaid: firstHalf, paymentDate: daysAfter(salesDone, 2), remarks: 'Advance received for Workhub Demo Project.', createdAt: at(daysAfter(salesDone, 2)), createdBy: accounts.email });
        payments.push({ id: 15001 + index * 2, projectId: id, amountPaid: invoiceAmount - firstHalf, paymentDate: daysAfter(salesDone, 6), remarks: 'Balance settled.', createdAt: at(daysAfter(salesDone, 6)), createdBy: accounts.email });
      }
    }
    const received = payments.reduce((total, payment) => total + payment.amountPaid, 0);
    const lastPayment = payments.at(-1);
    const salesEntry = onboarded ? milestone(4) : undefined;
    const accountsEntry = step >= 6 ? milestone(6) : undefined;
    const installationEntry = step >= 7 ? milestone(7) : undefined;
    const completionDate = currentStage === 'COMPLETED' ? milestone(8) : undefined;
    const nextContact = step < 4 && !dropped ? dateOffset((slot % 5) - 2) : undefined;
    const lastContact = dateOffset(-(slot % 6) - 1);
    const deletionPending = zone === 1 && dropped;

    const project: Project = {
      id, school: `Workhub Demo Project ${number}`, projectName: work,
      contactPerson: `Demo Contact ${number}`, contactNumber: `+1 202-555-${String(100 + index).padStart(4, '0')}`,
      place: `${district} Demo Campus`, district, zone: zoneAt(zone), region: zone === 0 ? 'North' : zone === 2 ? 'South' : (slot % 2 ? 'South' : 'North'),
      parentCompany: PARENT_COMPANY_OPTIONS[index % PARENT_COMPANY_OPTIONS.length], brc: `Demo Cluster ${zone + 1}`,
      executiveRemarks: dropped ? 'School postponed the project to the next academic year.' : `${work} discussed with the principal for Workhub Demo Project ${number}.`,
      createdBy: executive.email, createdDate, currentStage, previousStage: step > 0 ? ORDER[step - 1] : dropped ? 'IN_REVIEW' : undefined,
      onboarded: onboarded && !dropped,
      currentOwnerRole: dropped || step < 4 ? 'ROLE_EXECUTIVE' : step <= 5 ? 'ROLE_SALES_COORDINATOR' : step === 6 ? 'ROLE_ACCOUNTS' : 'ROLE_INSTALLATION',
      firstMeetingOutcome: currentStage === 'LEAD' ? undefined : OUTCOMES[index % OUTCOMES.length], lastContact, nextContact, lastVisitDate: lastContact,
      stageChangeTimestamp: at(stageEntered), stageChangedBy: step >= 7 ? accounts.email : step === 6 ? sales.email : executive.email,
      projectType: PROJECT_TYPES[index % PROJECT_TYPES.length], projectCategory: ['A', 'B', 'C'][index % 3], enquiryType: ENQUIRIES[index % ENQUIRIES.length], needHelp: slot === 4 ? 'SALES_OFFICE' : 'NO_NEED',
      salesOffice: slot === 4, projectValue, invoiceAmount,
      salesRemarks: onboarded ? 'Quotation finalised with the school committee.' : undefined,
      quotationRemarks: onboarded ? `Quotation WD-${number} shared and approved.` : undefined,
      installationTaskList: onboarded ? `Site survey; deliver ${work.toLowerCase()} items; assemble; safety check; handover.` : undefined,
      expectedDeliveryDate: !onboarded || currentStage === 'ONBOARDED' ? undefined : step < 7 ? dateOffset(10 + slot) : milestone(7),
      projectClassification: onboarded ? (['I1', 'I2', 'I3'] as const)[index % 3] : undefined,
      salesUserEmail: onboarded ? sales.email : undefined, salesEntryDate: salesEntry, salesUpdatedTimestamp: salesEntry ? at(salesEntry) : undefined,
      salesCompletedAt: accountsEntry ? at(accountsEntry) : undefined,
      paymentStatus: !invoiceAmount ? 'PENDING_INPUT' : received >= invoiceAmount ? 'COMPLETED' : received > 0 ? 'PARTIAL' : 'PENDING',
      amountReceived: received, totalPaidAmount: received, totalReceived: received, pendingAmount: invoiceAmount ? invoiceAmount - received : 0,
      paymentDate: lastPayment?.paymentDate, paymentRemarks: lastPayment?.remarks, paymentHistory: payments,
      accountsUserEmail: accountsEntry ? accounts.email : undefined, accountsEntryDate: accountsEntry, accountsUpdatedTimestamp: lastPayment ? at(lastPayment.paymentDate) : undefined,
      accountsCompletedAt: installationEntry ? at(installationEntry) : undefined,
      installationStatus: currentStage === 'COMPLETED' ? 'WORK_DONE' : 'PENDING',
      installationRemarks: currentStage === 'COMPLETED' ? 'Installed, inspected and handed over to the school.' : currentStage === 'INSTALLATION' ? 'Materials delivered; assembly scheduled.' : undefined,
      installationUserEmail: installationEntry ? installation.email : undefined, installationEntryDate: installationEntry,
      completionDate, installationCompletedAt: completionDate ? at(completionDate) : undefined,
      feedbackCollected: currentStage === 'COMPLETED' && zone === 0,
      lastUpdatedAt: at(installationEntry ?? accountsEntry ?? salesEntry ?? createdDate, '12:00:00'), lastUpdatedBy: executive.email,
      deletionRequestStatus: deletionPending ? 'PENDING' : 'NONE',
      deletionRequestReason: deletionPending ? 'Duplicate of an existing Workhub Demo Project.' : undefined,
    };
    projects.push(project);

    // Activity and audit history mirrors what each role did to reach this stage.
    track(executive, 'EXECUTIVE_LEAD_CREATED', 'PROJECT', project, at(createdDate, '09:00:00'), 'PROJECT CREATED', `Created ${project.school}.`);
    if (step >= 1) track(executive, 'EXECUTIVE_STAGE_ADVANCED', 'PROJECT', project, at(milestone(1)), 'PROJECT MOVED', `${project.school} moved forward after the first meeting.`);
    if (salesEntry) track(executive, 'EXECUTIVE_STAGE_ADVANCED', 'PROJECT', project, at(salesEntry), 'PROJECT MOVED', `${project.school} onboarded.`);
    if (step >= 5) track(sales, 'SALES_DETAILS_UPDATED', 'PROJECT', project, at(milestone(5)), 'SALES DATA UPDATED', `Invoice prepared for ${project.school}.`);
    payments.forEach(payment => track(accounts, 'ACCOUNTS_PAYMENT_RECORDED', 'PAYMENT', project, at(payment.paymentDate, '15:00:00'), 'PAYMENT RECORDED', `Payment of Rs ${payment.amountPaid} recorded for ${project.school}.`));
    if (completionDate) track(installation, 'INSTALLATION_COMPLETED', 'INSTALLATION', project, at(completionDate, '16:00:00'), 'PROJECT COMPLETED', `${project.school} installation completed.`);
    if (deletionPending) track(executive, 'EXECUTIVE_PROJECT_UPDATED', 'PROJECT', project, at(dateOffset(-1)), 'DELETION REQUESTED', `Deletion requested for ${project.school}.`);

    // School visits for projects still with the executive.
    if (step >= 0 && step <= 4) {
      const scheduledFor = dateOffset((slot % 4) - 1);
      const visited = scheduledFor < today() && slot % 2 === 0;
      visits.push({ id: 13001 + visits.length, projectId: id, school: project.school, projectName: project.projectName, scheduledFor, assignedTo: executive.email, scheduledBy: executive.email, executiveRemark: `Visit ${project.school} to review the ${work.toLowerCase()}.`, status: visited ? 'VISITED' : 'SCHEDULED', visitNote: visited ? 'Met the principal and walked the site.' : undefined, outcomeRecordedAt: visited ? at(scheduledFor, '17:00:00') : undefined, outcomeRecordedBy: visited ? executive.email : undefined, createdAt: at(dateOffset(-3)) });
    }
  });

  // Recent sign-ins by every demo login, for the audit log's login tab.
  users.filter(user => DEMO_ACCOUNTS.some(account => account.id === user.id)).forEach((user, index) => [0, 1, 3].forEach(day => {
    audits.push({ id: 0, event: 'USER LOGIN', description: `${user.name} signed in.`, actor: { name: user.name, email: user.email, role: user.role, zone: user.zone }, category: 'LOGIN', timestamp: at(dateOffset(-day), `0${8 + (index % 2)}:${String(10 + index * 5).padStart(2, '0')}:00`) });
  }));

  const procurement = staff('ROLE_PRODUCTION', 0);
  const products: ProductionProduct[] = PRODUCTS.map((name, index) => ({ id: 12001 + index, name, category: PRODUCTION_CATEGORY_OPTIONS[index % PRODUCTION_CATEGORY_OPTIONS.length], status: 'ACTIVE' }));
  const current = new Date();
  const entries: ProductionEntry[] = products.flatMap((product, index) => Array.from({ length: 6 }, (_, offset) => {
    const period = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    return { entryId: 14001 + index * 6 + offset, month: period.getMonth() + 1, year: period.getFullYear(), productId: product.id, productName: product.name, category: product.category, quantity: 8 + ((index * 7 + offset * 5) % 17), timestamp: period.toISOString(), updatedByEmail: procurement.email, updatedByName: procurement.name, updatedByRole: 'ROLE_PRODUCTION', updatedByZone: 'ZONE_1' };
  }));

  audits.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).forEach((row, index) => { row.id = 17001 + index; });
  return { version: 1, provenance: 'workhub-demo-fictional-v1', users, projects, products, visits, entries, activities, audits };
}
