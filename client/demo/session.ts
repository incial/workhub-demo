import type { AuthResponse, User, UserRole, Zone } from '../types';

/** Every demo login shares this password. */
export const DEMO_PASSWORD = 'incial';
/** The all-access showcase identity (admin workspace with view switcher). */
export const DEMO_EMAIL = 'incial@demo.in';
export const DEMO_TOKEN = 'workhub-demo:local-v1';
export const DEMO_SESSION_KEY = 'workhub-demo.session.v2';
export const DEMO_ACTOR_ID = 9001;

export interface DemoAccount {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  zone?: Zone;
  /** Short label shown on the login page. */
  label: string;
  description: string;
}

/**
 * Dedicated login per role. Role accounts are real seeded staff records (ids
 * match `demo/seed.ts`), so each one sees the data that role owns.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { id: DEMO_ACTOR_ID, email: DEMO_EMAIL, name: 'Demo User', role: 'ROLE_DEMO', label: 'All access', description: 'Admin workspace with Admin / Super Admin view switcher' },
  { id: 9100, email: 'superadmin@demo.in', name: 'Demo Super Admin', role: 'ROLE_SUPER_ADMIN', label: 'Super Admin', description: 'Analytics, reports, tracking and audit logs' },
  { id: 9101, email: 'admin@demo.in', name: 'Demo Admin', role: 'ROLE_ADMIN', label: 'Admin', description: 'Every operational workspace across zones' },
  { id: 9103, email: 'executive@demo.in', name: 'Demo Executive', role: 'ROLE_EXECUTIVE', zone: 'ZONE_1', label: 'Executive', description: 'Own leads, visits and stage moves' },
  { id: 9104, email: 'billing@demo.in', name: 'Demo Billing Coordinator', role: 'ROLE_SALES_COORDINATOR', label: 'Billing', description: 'Quotations, invoices and delivery dates' },
  { id: 9105, email: 'accounts@demo.in', name: 'Demo Accounts', role: 'ROLE_ACCOUNTS', label: 'Accounts', description: 'Record payments against invoices' },
  { id: 9107, email: 'procurement@demo.in', name: 'Demo Procurement', role: 'ROLE_PRODUCTION', label: 'Procurement', description: 'Product catalogue and monthly quantities' },
];

export const isDemoEmail = (email: string): boolean => email.trim().toLowerCase() === DEMO_EMAIL;
export const findDemoAccount = (email: string): DemoAccount | undefined =>
  DEMO_ACCOUNTS.find(account => account.email === email.trim().toLowerCase());
export const demoAccountById = (id: number): DemoAccount | undefined => DEMO_ACCOUNTS.find(account => account.id === id);
export const scopedUiKey = (key: string): string => hasDemoMarker() ? `workhub-demo.ui.${key}` : key;

const toAuthResponse = (account: DemoAccount): AuthResponse => {
  const user: User = { id: account.id, name: account.name, email: account.email, role: account.role, termsAccepted: true };
  if (account.zone) user.zone = account.zone;
  return { statusCode: 200, token: DEMO_TOKEN, role: account.role, user, message: 'Local demo with fictional projects.' };
};

export function demoLogin(email: string, password: string): AuthResponse | null {
  const account = findDemoAccount(email);
  return account && password === DEMO_PASSWORD ? toAuthResponse(account) : null;
}

export function hasDemoMarker(): boolean {
  return localStorage.getItem(DEMO_SESSION_KEY) !== null;
}

export function restoreDemoSession(): AuthResponse | null {
  try {
    const value = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null');
    if (value?.version !== 2 || Object.keys(value).length !== 3) return null;
    const account = demoAccountById(value.actorId);
    return account && account.email === value.email ? toAuthResponse(account) : null;
  } catch { return null; }
}

export function startDemoSession(actorId: number = DEMO_ACTOR_ID): void {
  const account = demoAccountById(actorId);
  if (!account) throw new Error('Unknown demo account.');
  try {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ version: 2, actorId: account.id, email: account.email }));
    clearActiveIdentity();
  } catch { throw new Error('Demo mode needs browser storage. Allow local storage and try again.'); }
}

export function clearActiveIdentity(): void {
  for (const key of ['token', 'user', 'loginTimestamp']) {
    localStorage.removeItem(key);
  }
}

export function endDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
  clearActiveIdentity();
}

export function reloadAtLoginRoute(route: '/dashboard' | '/login' | '/'): void {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${route}`);
  window.location.reload();
}
