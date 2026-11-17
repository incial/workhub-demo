type Attempt = { fingerprint: string; requestId: string };
type RetryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const attempts = new Map<number, Attempt>();

const browserStorage = (): RetryStorage | undefined => {
  try { return globalThis.sessionStorage; } catch { return undefined; }
};

export const paymentRequestId = (projectId: number, data: object, storage = browserStorage(), uuid = () => crypto.randomUUID()): string => {
  const key = `payment-attempt:${projectId}`;
  const fingerprint = JSON.stringify(data, Object.keys(data).sort());
  let previous = attempts.get(projectId);
  try { previous = JSON.parse(storage?.getItem(key) || 'null') || previous; } catch { /* Use in-memory retry state if storage is unavailable. */ }
  const attempt = previous?.fingerprint === fingerprint ? previous : { fingerprint, requestId: uuid() };
  attempts.set(projectId, attempt);
  try { storage?.setItem(key, JSON.stringify(attempt)); } catch { /* Retry state remains available for this session. */ }
  return attempt.requestId;
};

export const completePaymentRequest = (projectId: number, storage = browserStorage()): void => {
  attempts.delete(projectId);
  try { storage?.removeItem(`payment-attempt:${projectId}`); } catch { /* Successful payment is already confirmed. */ }
};
