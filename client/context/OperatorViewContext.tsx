import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { scopedUiKey } from '../demo/session';

export type OperatorViewMode = 'ADMIN' | 'SUPER_ADMIN';

interface OperatorViewContextType {
  operatorViewMode: OperatorViewMode;
  setOperatorViewMode: (mode: OperatorViewMode) => void;
  isOperator: boolean;
  effectiveRole: string | undefined;
}

const STORAGE_KEY = 'operatorViewMode';
const OperatorViewContext = createContext<OperatorViewContextType | undefined>(undefined);

const normalizeMode = (value: string | null): OperatorViewMode => {
  if (value === 'ADMIN' || value === 'SUPER_ADMIN') return value;
  return 'ADMIN';
};

export const OperatorViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemo } = useAuth();
  const isOperator = user?.role === 'ROLE_OPERATOR' || isDemo;
  const storageKey = scopedUiKey(STORAGE_KEY);
  const [operatorViewMode, setOperatorViewModeState] = useState<OperatorViewMode>(() =>
    normalizeMode(localStorage.getItem(storageKey))
  );

  useEffect(() => {
    if (!isOperator) {
      localStorage.removeItem(storageKey);
      setOperatorViewModeState('ADMIN');
      return;
    }
    localStorage.setItem(storageKey, operatorViewMode);
  }, [isOperator, operatorViewMode, storageKey]);

  const setOperatorViewMode = (mode: OperatorViewMode) => {
    setOperatorViewModeState(mode);
  };

  const effectiveRole = useMemo(() => {
    if (!user?.role) return undefined;
    if (!isOperator) return user.role;
    return operatorViewMode === 'SUPER_ADMIN' ? 'ROLE_SUPER_ADMIN' : 'ROLE_ADMIN';
  }, [isOperator, operatorViewMode, user?.role]);

  return (
    <OperatorViewContext.Provider value={{ operatorViewMode, setOperatorViewMode, isOperator, effectiveRole }}>
      {children}
    </OperatorViewContext.Provider>
  );
};

export const useOperatorView = () => {
  const context = useContext(OperatorViewContext);
  if (!context) throw new Error('useOperatorView must be used within OperatorViewProvider');
  return context;
};
