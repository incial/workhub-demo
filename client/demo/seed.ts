import type { Project, ProjectStage, User, UserRole, Zone } from '../types';
import type { DemoState } from './store';
import { DEMO_ACCOUNTS } from './session';

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString();
export const dateOffset = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const stages: ProjectStage[] = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED'];
const staffRoles: UserRole[] = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_EXECUTIVE', 'ROLE_SALES_COORDINATOR', 'ROLE_ACCOUNTS', 'ROLE_INSTALLATION', 'ROLE_PRODUCTION', 'ROLE_ZONAL_MANAGER', 'ROLE_FEEDBACK', 'ROLE_EMPLOYEE', 'ROLE_CLIENT'];
const zoneAt = (index: number): Zone => (['ZONE_1', 'ZONE_2', 'ZONE_3'] as Zone[])[index % 3];
const schoolNames = ['Aurora', 'Meadow', 'Cedar', 'Bluebell', 'Willow', 'Silverleaf', 'Maple', 'Sunrise', 'Rainbow', 'Starlight', 'Riverstone', 'Oakwood', 'Moonbeam', 'Pinecrest', 'Springvale', 'Hillside', 'Lakeshore', 'Evergreen', 'Sunflower', 'Cloudberry', 'Brightwater', 'Rosewood', 'Elmwood', 'Skylark', 'Brookfield', 'Amberwood', 'Lavender', 'Seabreeze', 'Goldenleaf', 'Hazelwood'];

/**
 * Starting data for the showcase: every role, login account and staff user,
 * with no projects and no procurement products. Pass `{ sampleProjects: true }`
 * for the fictional pipeline and catalogue used by the tests.
 */
export function createDemoSeed({ sampleProjects = false }: { sampleProjects?: boolean } = {}): DemoState {
  const users: User[] = [{ id: 9001, name: 'Demo User', email: 'incial@demo.in', role: 'ROLE_DEMO', termsAccepted: true, createdAt: dateOffset(-90) }];
  for (let zone = 0; zone < 3; zone++) for (const [index, role] of staffRoles.entries()) {
    const id = 9100 + zone * 20 + index;
    const account = DEMO_ACCOUNTS.find(item => item.id === id);
    const key = role === 'ROLE_PRODUCTION' ? 'procurement' : role.replace('ROLE_', '').toLowerCase();
    const title = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    users.push(account
      ? { id, name: account.name, email: account.email, role, ...(account.zone ? { zone: account.zone } : {}), termsAccepted: true, createdAt: dateOffset(-90) }
      : { id, name: `Demo ${title} ${zone + 1}`, email: `${key}${zone + 1}@staff.example`, role, zone: zoneAt(zone), termsAccepted: true, createdAt: dateOffset(-90) });
  }
  /** Email of the seeded staff member for a role in a zone (zone 1 staff are the login accounts). */
  const staff = (role: UserRole, zone: number) => users.find(user => user.id === 9100 + zone * 20 + staffRoles.indexOf(role))!.email;
  const projects: Project[] = !sampleProjects ? [] : schoolNames.map((name, index) => {
    const currentStage = stages[index % stages.length];
    const step = stages.indexOf(currentStage);
    const invoiceAmount = step >= 4 && currentStage !== 'DROPPED' ? 80000 + index * 4500 : undefined;
    const received = invoiceAmount ? (currentStage === 'COMPLETED' || currentStage === 'INSTALLATION' ? invoiceAmount : currentStage === 'ACCOUNTS' ? Math.round(invoiceAmount / 2) : 0) : 0;
    const createdDate = dateOffset(-(index % 12 + 1));
    return {
      id: 10001 + index, school: `Demo ${name} School`, projectName: ['Discovery Lab', 'Learning Garden', 'Creative Classroom'][index % 3],
      contactPerson: `Fictional Contact ${index + 1}`, contactNumber: `+1 202-555-${String(100 + index).padStart(4, '0')}`,
      place: ['Demo North Town', 'Demo South Town', 'Demo Central Town'][index % 3], district: ['Sample District A', 'Sample District B', 'Sample District C'][index % 3],
      zone: zoneAt(index), region: index % 2 ? 'South' : 'North', parentCompany: ['Demo Learning Foundation', 'Demo Future Trust'][index % 2],
      executiveRemarks: 'Fictional school record for local demonstration.', createdBy: staff('ROLE_EXECUTIVE', index % 3), createdDate,
      currentStage, onboarded: step >= 4 && currentStage !== 'DROPPED', currentOwnerRole: step < 4 ? 'ROLE_EXECUTIVE' : step <= 5 ? 'ROLE_SALES_COORDINATOR' : step === 6 ? 'ROLE_ACCOUNTS' : 'ROLE_INSTALLATION',
      firstMeetingOutcome: ['POSITIVE', 'FIFTY_FIFTY', 'NEGATIVE'][index % 3] as Project['firstMeetingOutcome'],
      lastContact: dateOffset(-(index % 4)), nextContact: dateOffset(index % 5 - 2), lastVisitDate: dateOffset(-(index % 4)),
      stageChangeTimestamp: createdDate + 'T10:00:00Z', stageChangedBy: staff('ROLE_EXECUTIVE', index % 3),
      projectType: ['STAR', 'COMMON', 'ART_AND_CRAFTS', 'SYSTEMATICS'][index % 4] as Project['projectType'], projectCategory: ['A', 'B', 'C'][index % 3], enquiryType: 'INDOOR', needHelp: 'NO_NEED', brc: `Demo Cluster ${index % 3 + 1}`,
      projectValue: invoiceAmount ?? 50000 + index * 2500, invoiceAmount,
      salesRemarks: invoiceAmount ? 'Demonstration quotation reviewed.' : undefined, installationTaskList: invoiceAmount ? 'Assemble learning fixtures and inspect sample equipment.' : undefined,
      quotationRemarks: invoiceAmount ? 'Fictional quotation, no commercial commitment.' : undefined, expectedDeliveryDate: invoiceAmount ? dateOffset(index % 6 - 2) : undefined,
      projectClassification: 'I2', salesUserEmail: invoiceAmount ? staff('ROLE_SALES_COORDINATOR', index % 3) : undefined, salesEntryDate: invoiceAmount ? createdDate : undefined,
      salesCompletedAt: step >= 6 && currentStage !== 'DROPPED' ? createdDate : undefined,
      paymentStatus: received === invoiceAmount ? 'COMPLETED' : received > 0 ? 'PARTIAL' : 'PENDING', amountReceived: received, totalPaidAmount: received, totalReceived: received, pendingAmount: invoiceAmount ? invoiceAmount - received : 0,
      paymentDate: received ? dateOffset(-1) : undefined, paymentRemarks: received ? 'Fictional sample receipt.' : undefined,
      accountsUserEmail: step >= 6 && currentStage !== 'DROPPED' ? staff('ROLE_ACCOUNTS', index % 3) : undefined, accountsEntryDate: step >= 6 ? createdDate : undefined, accountsCompletedAt: step >= 7 && currentStage !== 'DROPPED' ? createdDate : undefined,
      paymentHistory: received ? [{ id: 15000 + index, projectId: 10001 + index, amountPaid: received, paymentDate: dateOffset(-1), remarks: 'Fictional sample payment.', createdAt: dateOffset(-1), createdBy: staff('ROLE_ACCOUNTS', index % 3) }] : [],
      installationStatus: currentStage === 'COMPLETED' ? 'WORK_DONE' : 'PENDING', installationRemarks: step >= 7 ? 'Demonstration installation checklist.' : undefined,
      installationUserEmail: step >= 7 && currentStage !== 'DROPPED' ? staff('ROLE_INSTALLATION', index % 3) : undefined, installationEntryDate: step >= 7 ? createdDate : undefined,
      completionDate: currentStage === 'COMPLETED' ? dateOffset(-1) : undefined, installationCompletedAt: currentStage === 'COMPLETED' ? dateOffset(-1) : undefined,
      feedbackCollected: currentStage === 'COMPLETED' && index % 3 === 0, lastUpdatedAt: now(), lastUpdatedBy: staff('ROLE_EXECUTIVE', index % 3),
      deletionRequestStatus: index === 9 ? 'PENDING' : 'NONE', deletionRequestReason: index === 9 ? 'Demo duplicate school record.' : undefined,
    };
  });
  const products = !sampleProjects ? [] : [ { id: 12001, name: 'Demo Learning Panel', category: 'Classroom', status: 'ACTIVE' }, { id: 12002, name: 'Demo Activity Table', category: 'Furniture', status: 'ACTIVE' }, { id: 12003, name: 'Demo Science Display', category: 'Laboratory', status: 'ACTIVE' }, { id: 12004, name: 'Demo Garden Kit', category: 'Outdoor', status: 'ACTIVE' } ];
  const date = new Date();
  return {
    version: 1, provenance: 'workhub-demo-fictional-v1', users, projects, products,
    visits: projects.slice(0, 12).map((project, index) => ({ id: 13001 + index, projectId: project.id, school: project.school, projectName: project.projectName, scheduledFor: dateOffset(index % 4 - 1), assignedTo: project.createdBy, scheduledBy: 'incial@demo.in', executiveRemark: 'Fictional planned school visit.', status: index % 3 === 0 ? 'VISITED' : 'SCHEDULED', visitNote: index % 3 === 0 ? 'Sample learning spaces reviewed.' : undefined, outcomeRecordedAt: index % 3 === 0 ? now() : undefined, createdAt: now() })),
    entries: !sampleProjects ? [] : products.flatMap((product, index) => [0, 1, 2].map(offset => { const period = new Date(date.getFullYear(), date.getMonth() - offset, 1); return { entryId: 14001 + index * 3 + offset, month: period.getMonth() + 1, year: period.getFullYear(), productId: product.id, productName: product.name, category: product.category, quantity: (index + 1) * 12 + offset * 4, timestamp: period.toISOString(), updatedByEmail: staff('ROLE_PRODUCTION', 0), updatedByName: 'Demo Procurement', updatedByRole: 'ROLE_PRODUCTION', updatedByZone: 'ZONE_1' }; })),
    activities: projects.map((project, index) => ({ id: 16001 + index, userId: users.find(user => user.email === project.createdBy)!.id, userRole: 'ROLE_EXECUTIVE', actionType: 'EXECUTIVE_LEAD_CREATED', entityType: 'PROJECT', entityId: project.id, timestamp: project.createdDate + 'T09:00:00Z', metadata: { school: project.school, projectName: project.projectName, zone: project.zone } })),
    audits: !sampleProjects ? [] : [
      ...projects.slice(0, 10).map((project, index) => ({ id: 17001 + index, event: 'PROJECT CREATED', description: `Created fictional school ${project.school}.`, projectName: project.projectName, actor: { name: 'Demo Executive', email: project.createdBy, role: 'ROLE_EXECUTIVE', zone: project.zone }, category: 'PROJECT' as const, timestamp: project.createdDate + 'T09:00:00Z' })),
      ...['USER LOGIN', 'VISIT SCHEDULED', 'PROJECT UPDATED', 'PROJECT COMPLETED', 'PAYMENT RECORDED', 'DELETION REQUESTED', 'PASSWORD_CHANGED'].map((event, index) => ({ id: 17100 + index, event, description: 'Fictional demonstration activity.', projectName: index === 0 || index === 6 ? undefined : projects[index].projectName, actor: { name: 'Demo User', email: 'incial@demo.in', role: 'ROLE_DEMO', zone: 'ZONE_1' }, category: index === 0 ? 'LOGIN' as const : index === 6 ? 'PASSWORD' as const : 'PROJECT' as const, timestamp: now() })),
    ],
  };
}
