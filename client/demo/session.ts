import type { AuthResponse } from '../types';

export const DEMO_EMAIL = 'incial@demo.in';
export const DEMO_PASSWORD = 'incial';
export const DEMO_TOKEN = 'workhub-demo:local-v1';
export const DEMO_SESSION_KEY = 'workhub-demo.session.v1';
const DEMO_ACTOR_ID = 9001;

export const isDemoEmail = (email: string): boolean => email.trim().toLowerCase() === DEMO_EMAIL;
export const scopedUiKey = (key: string): string => hasDemoMarker() ? `workhub-demo.ui.${key}` : key;

export function demoLogin(email: string, password: string): AuthResponse | null {
  if (!isDemoEmail(email) || password !== DEMO_PASSWORD) return null;
  return {
    statusCode: 200, token: DEMO_TOKEN, role: 'ROLE_DEMO',
    user: { id: DEMO_ACTOR_ID, name: 'Demo User', email: DEMO_EMAIL, role: 'ROLE_DEMO' },
    message: 'Local demo with fictional projects.',
  };
}

export function hasDemoMarker(): boolean {
  return localStorage.getItem(DEMO_SESSION_KEY) !== null;
}

export function restoreDemoSession(): AuthResponse | null {
  try {
    const value = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null');
    return value?.version === 1 && value.actorId === DEMO_ACTOR_ID && value.email === DEMO_EMAIL
      && Object.keys(value).length === 3 ? demoLogin(DEMO_EMAIL, DEMO_PASSWORD) : null;
  } catch { return null; }
}

export function startDemoSession(): void {
  try {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ version: 1, actorId: DEMO_ACTOR_ID, email: DEMO_EMAIL }));
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

export function reloadAtLoginRoute(route: '/dashboard' | '/login'): void {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${route}`);
  window.location.reload();
}
