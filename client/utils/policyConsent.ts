import { User } from '../types';

export const CURRENT_POLICY_VERSION = 'v1';

export const requiresPolicyConsent = (user: User | null | undefined): boolean => {
  if (!user) return false;

  const termsNotAccepted = user.termsAccepted === false;
  const versionOutdated =
    typeof user.policyVersion === 'string' &&
    user.policyVersion.trim() !== '' &&
    user.policyVersion !== CURRENT_POLICY_VERSION;

  return termsNotAccepted || versionOutdated;
};

