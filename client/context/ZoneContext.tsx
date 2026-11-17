import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useOperatorView } from './OperatorViewContext';
import { scopedUiKey } from '../demo/session';

const ALL_ZONES = 'ALL_ZONES';
const ZONE_STORAGE_KEY = 'superAdminActiveZone';
const VALID_ZONES = ['ZONE_1', 'ZONE_2', 'ZONE_3'] as const;
type ZoneValue = typeof VALID_ZONES[number] | typeof ALL_ZONES;

interface ZoneContextType {
  activeZone: ZoneValue;
  setActiveZone: (zone: ZoneValue) => void;
  effectiveZone: string | undefined;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canSwitchZone: boolean;
}

const ZoneContext = createContext<ZoneContextType | undefined>(undefined);

const normalizeStoredZone = (zone: string | null): ZoneValue => {
  if (!zone) return ALL_ZONES;
  if (zone === ALL_ZONES) return ALL_ZONES;
  return (VALID_ZONES as readonly string[]).includes(zone) ? (zone as ZoneValue) : ALL_ZONES;
};

export const ZoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveRole } = useOperatorView();
  const isSuperAdmin = effectiveRole === 'ROLE_SUPER_ADMIN';
  const isAdmin = effectiveRole === 'ROLE_ADMIN';
  const canSwitchZone = isAdmin || isSuperAdmin;
  const storageKey = scopedUiKey(ZONE_STORAGE_KEY);
  const [activeZone, setActiveZoneState] = useState<ZoneValue>(() => {
    if (isAdmin) {
      return ALL_ZONES;
    }
    if (isSuperAdmin) {
      return normalizeStoredZone(localStorage.getItem(storageKey));
    }
    return normalizeStoredZone(localStorage.getItem(storageKey));
  });

  useEffect(() => {
    if (canSwitchZone) {
      localStorage.setItem(storageKey, activeZone);
    } else if (localStorage.getItem(storageKey) !== null) {
      localStorage.removeItem(storageKey);
    }
  }, [activeZone, canSwitchZone, storageKey]);

  const setActiveZone = useCallback((zone: ZoneValue) => {
    setActiveZoneState((previous) => (previous === zone ? previous : zone));
  }, []);
  const resolvedActiveZone: ZoneValue = canSwitchZone
    ? activeZone
    : ((user?.zone && (VALID_ZONES as readonly string[]).includes(user.zone)) ? (user.zone as ZoneValue) : ALL_ZONES);

  const effectiveZone = useMemo(() => {
    if (canSwitchZone) {
      return resolvedActiveZone === ALL_ZONES ? undefined : resolvedActiveZone;
    }
    if (isAdmin || isSuperAdmin) {
      return undefined;
    }
    return user?.zone || undefined;
  }, [canSwitchZone, isAdmin, isSuperAdmin, resolvedActiveZone, user?.zone]);

  const value = useMemo(() => ({
    activeZone: resolvedActiveZone,
    setActiveZone,
    effectiveZone,
    isAdmin,
    isSuperAdmin,
    canSwitchZone
  }), [resolvedActiveZone, setActiveZone, effectiveZone, isAdmin, isSuperAdmin, canSwitchZone]);

  return (
    <ZoneContext.Provider value={value}>
      {children}
    </ZoneContext.Provider>
  );
};

export const useZone = () => {
  const context = useContext(ZoneContext);
  if (!context) throw new Error('useZone must be used within ZoneProvider');
  return context;
};

export { ALL_ZONES, VALID_ZONES };
