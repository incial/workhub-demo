// An original, bundled WorkHub mark: demo screens never request company assets.
export const DEMO_LOGO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#191970"/><path d="m12 18 8 28h7l5-17 5 17h7l8-28h-8l-4 18-5-18h-7l-5 18-4-18z" fill="white"/></svg>');

let installed = false;

/**
 * This build is a frontend-only showcase: there is no backend, so the local
 * boundary is always active and every API call is answered in the browser.
 */
export function isDemoBoundaryActive(): boolean {
  return true;
}

// The Vite dev server needs its own websocket/module connections for hot reload.
const isViteDevServer = (): boolean => {
  try { return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV); } catch { return false; }
};

const blocked = () => new Error('Demo mode is isolated. Network connections are disabled.');

function isLocalBlob(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'blob:' && url.origin === window.location.origin;
  } catch { return false; }
}

/** Only inline images, local blobs and the dedicated static demo directory are safe. */
export function safeDemoImage(value?: string): string {
  if (!value) return DEMO_LOGO;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)(?:;|,)/i.test(value)) return value;
  if (isLocalBlob(value)) return value;
  try {
    const url = new URL(value, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith('/demo/')
      && /\.(?:svg|png|jpe?g|gif|webp|avif|ico)$/i.test(url.pathname)
      && !/[\\]|%(?:2e|2f|5c)/i.test(value)) return value;
  } catch { /* Invalid image URLs use the bundled mark. */ }
  return DEMO_LOGO;
}

function isLocalNavigation(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith('#') || isLocalBlob(value));
}

/** Installed before App is imported; intentionally persists until a fresh document. */
export function installDemoBoundary(): void {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined' || isViteDevServer()) return;
  installed = true;

  // Browser enforcement also covers transports retained by code before a wrapper.
  // JavaScript/CSS remain local so code splitting works; API URLs cannot be images.
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = `default-src 'none'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob: ${window.location.origin}/demo/; font-src 'self' data:; media-src data: blob:; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; manifest-src 'none'`;
  document.head.appendChild(policy);

  window.fetch = (() => Promise.reject(blocked())) as typeof fetch;
  const NoConnection = class { constructor() { throw blocked(); } };
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'Worker', 'SharedWorker', 'RTCPeerConnection', 'webkitRTCPeerConnection']) {
    try { Object.defineProperty(window, name, { configurable: true, value: NoConnection }); } catch { /* CSP remains in force. */ }
  }
  try { Object.defineProperty(window.navigator, 'sendBeacon', { configurable: true, value: () => false }); } catch { /* CSP denies beacons. */ }
  try {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: Object.freeze({ controller: null, register: () => Promise.reject(blocked()), getRegistration: () => Promise.reject(blocked()), getRegistrations: () => Promise.resolve([]) }),
    });
  } catch { /* CSP denies worker creation and connection attempts. */ }

  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const value = url instanceof URL ? url.href : url;
    return isLocalNavigation(value) ? originalOpen(url, target, features) : null;
  }) as typeof window.open;

  const prevent = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const preventExternalNavigation = (event: Event) => {
    const target = event.target as Element | null;
    const anchor = target?.closest?.('a[href]');
    if (anchor && !isLocalNavigation(anchor.getAttribute('href'))) prevent(event);
  };
  document.addEventListener('click', preventExternalNavigation, true);
  document.addEventListener('auxclick', preventExternalNavigation, true);
  // Prevent native navigation while allowing React's local form handlers to run.
  document.addEventListener('submit', event => event.preventDefault(), true);
  if (window.HTMLFormElement) {
    for (const method of ['submit', 'requestSubmit']) {
      Object.defineProperty(window.HTMLFormElement.prototype, method, { configurable: true, value: () => { throw blocked(); } });
    }
  }
}
