import type { AuditLogRow, ProductionEntry, ProductionProduct, Project, SchoolVisit, User, UserActivityLog } from '../types';
import { createDemoSeed } from './seed';

export const DEMO_DATA_KEY = 'workhub-demo.data.v6';
export interface DemoState {
  version: 1;
  provenance: 'workhub-demo-fictional-v1';
  users: User[];
  projects: Project[];
  visits: SchoolVisit[];
  products: ProductionProduct[];
  entries: ProductionEntry[];
  activities: UserActivityLog[];
  audits: AuditLogRow[];
  authChallenge?: { kind: 'profile' | 'reset'; email: string; requestedAt: string };
}

const roles = new Set(['ROLE_DEMO', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_EXECUTIVE', 'ROLE_SALES_COORDINATOR', 'ROLE_ACCOUNTS', 'ROLE_INSTALLATION', 'ROLE_PRODUCTION', 'ROLE_ZONAL_MANAGER', 'ROLE_FEEDBACK', 'ROLE_EMPLOYEE', 'ROLE_CLIENT']);
const stages = new Set(['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED']);
export const fictionalEmail = (value: unknown): value is string => typeof value === 'string' && (/^[a-z0-9._-]+@demo\.in$/i.test(value) || /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.example$/i.test(value));

function isSafeTree(value: unknown, key = ''): boolean {
  if (/password|token|googleId|credential|otp/i.test(key)) return false;
  if (/email|createdBy|updatedBy|assignedTo|scheduledBy|recordedBy/i.test(key) && typeof value === 'string' && value.includes('@') && !fictionalEmail(value)) return false;
  if (/url|link/i.test(key) && typeof value === 'string' && value !== '') return false;
  if (typeof value === 'string') return value.length <= 10000 && !/https?:\/\/|data:image|<script/i.test(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 5000 && value.every(item => isSafeTree(item));
  if (value && typeof value === 'object') return Object.entries(value).every(([nestedKey, nestedValue]) => isSafeTree(nestedValue, nestedKey));
  return value === null || value === undefined || typeof value === 'boolean';
}

function validState(value: unknown): value is DemoState {
  const s = value as DemoState;
  if (!s || s.version !== 1 || s.provenance !== 'workhub-demo-fictional-v1' || !isSafeTree(s)) return false;
  if (Object.keys(s).some(key => !['version', 'provenance', 'users', 'projects', 'visits', 'products', 'entries', 'activities', 'audits', 'authChallenge'].includes(key))) return false;
  if (!['users', 'projects', 'visits', 'products', 'entries', 'activities', 'audits'].every(key => Array.isArray(s[key as keyof DemoState]))) return false;
  const idsValid = (items: { id: number }[]) => items.every(item => Number.isInteger(item?.id) && item.id >= 9000) && new Set(items.map(item => item.id)).size === items.length;
  if (!idsValid(s.users) || !idsValid(s.projects) || !idsValid(s.visits) || !idsValid(s.products) || !idsValid(s.activities) || !idsValid(s.audits)) return false;
  const actor = s.users.find(user => user.id === 9001);
  return actor?.email === 'incial@demo.in' && actor.role === 'ROLE_DEMO'
    && s.users.every(user => fictionalEmail(user.email) && typeof user.name === 'string' && roles.has(user.role))
    && s.projects.every(project => typeof project.school === 'string' && stages.has(project.currentStage) && fictionalEmail(project.createdBy))
    && s.visits.every(visit => s.projects.some(project => project.id === visit.projectId) && fictionalEmail(visit.assignedTo))
    && s.products.every(product => typeof product.name === 'string' && typeof product.category === 'string')
    && s.entries.every(entry => s.products.some(product => product.id === entry.productId) && Number.isFinite(entry.quantity) && entry.quantity >= 0);
}

export function writeDemoState(state: DemoState): void {
  if (!validState(state)) throw new Error('Invalid fictional demo data. Reset the demo to continue.');
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(state));
}

export function readDemoState(): DemoState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DEMO_DATA_KEY) || 'null');
    if (validState(value)) return value;
  } catch { /* Only this namespaced fictional store is considered. */ }
  const seed = createDemoSeed();
  writeDemoState(seed);
  return seed;
}

export function resetDemoState(): void { localStorage.removeItem(DEMO_DATA_KEY); }
