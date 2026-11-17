import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, PanelLeft, Search, User, LogOut, MapPin, TableProperties, CalendarDays, FileText, Activity } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { ALL_ZONES, VALID_ZONES, useZone } from '../../context/ZoneContext';
import { type OperatorViewMode, useOperatorView } from '../../context/OperatorViewContext';
import { usersApi } from '../../services/api';
import { User as AppUser } from '../../types';
import { formatZoneLabel } from '../../utils';
import { safeDemoImage } from '../../demo/network';
import { formatRoleLabel } from '../../utils/roleLabel';

export const Navbar: React.FC = () => {
  const { user, logout, isDemo } = useAuth();
  const { toggleSidebar, showSidebar } = useLayout();
  const { activeZone, setActiveZone, isAdmin, isSuperAdmin, canSwitchZone } = useZone();
  const { isOperator, operatorViewMode, setOperatorViewMode, effectiveRole } = useOperatorView();
  const location = useLocation();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isZoneOpen, setIsZoneOpen] = useState(false);
  const [isOperatorModeOpen, setIsOperatorModeOpen] = useState(false);
  const [executives, setExecutives] = useState<AppUser[]>([]);
  const [executivesLoading, setExecutivesLoading] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const operatorModeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (zoneRef.current && !zoneRef.current.contains(event.target as Node)) {
        setIsZoneOpen(false);
      }
      if (operatorModeRef.current && !operatorModeRef.current.contains(event.target as Node)) {
        setIsOperatorModeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsProfileOpen(false);
    setIsZoneOpen(false);
    setIsOperatorModeOpen(false);
  }, [location.pathname]);

  const getPageContext = () => {
    return 'Workhub OS';
  };

  const handleNavigateToProfile = () => {
    setIsProfileOpen(false);
    navigate('/profile', {
      state: {
        from: `${location.pathname}${location.search}${location.hash}`
      }
    });
  };

  const handleNavigateToTracking = () => {
    setIsProfileOpen(false);
    navigate('/tracking');
  };

  const handleNavigateToReport = () => {
    setIsProfileOpen(false);
    navigate('/reports');
  };

  const handleNavigateToAuditLogs = () => {
    setIsProfileOpen(false);
    navigate('/audit-logs');
  };

  const operatorViewOptions: Array<{ mode: OperatorViewMode; label: string; compactLabel: string; path: string }> = [
    { mode: 'ADMIN', label: 'Admin', compactLabel: 'Admin', path: '/projects' },
    { mode: 'SUPER_ADMIN', label: 'Super Admin', compactLabel: 'Super', path: '/dashboard' }
  ];

  const activeOperatorView = operatorViewOptions.find((option) => option.mode === operatorViewMode) || operatorViewOptions[0];

  const handleOperatorViewChange = (mode: OperatorViewMode, path: string) => {
    flushSync(() => setOperatorViewMode(mode));
    setIsOperatorModeOpen(false);
    navigate(path);
  };

  const isEffectiveExecutive = effectiveRole === 'ROLE_EXECUTIVE';
  const isEffectiveAdmin = effectiveRole === 'ROLE_ADMIN';
  const isEffectiveSuperAdmin = effectiveRole === 'ROLE_SUPER_ADMIN';
  const isEffectiveOperator = effectiveRole === 'ROLE_OPERATOR';
  const isExecutiveWorkspaceAdmin = isEffectiveAdmin && location.pathname === '/projects';
  const selectedExecutiveId = (() => {
    const value = Number(new URLSearchParams(location.search).get('executiveId'));
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  })();
  const selectedExecutive = executives.find((executive) => executive.id === selectedExecutiveId);
  const adminZoneLockedPaths = ['/projects', '/sales', '/accounts', '/installation', '/procurement'];
  const isZoneSwitchLockedForAdmin = isAdmin && !isExecutiveWorkspaceAdmin && adminZoneLockedPaths.includes(location.pathname);

  useEffect(() => {
    if (!isExecutiveWorkspaceAdmin) {
      setExecutives([]);
      return;
    }

    let cancelled = false;
    setExecutivesLoading(true);
    usersApi.getDirectory(undefined, ['ROLE_EXECUTIVE'])
      .then((directory) => {
        if (cancelled) return;
        setExecutives(
          directory
            .filter((member) => member.role === 'ROLE_EXECUTIVE')
            .sort((left, right) => left.name.localeCompare(right.name))
        );
      })
      .catch(() => {
        if (!cancelled) setExecutives([]);
      })
      .finally(() => {
        if (!cancelled) setExecutivesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isExecutiveWorkspaceAdmin]);

  const handleExecutiveViewChange = (executiveId?: number) => {
    const params = new URLSearchParams(location.search);
    if (executiveId) {
      params.set('executiveId', String(executiveId));
    } else {
      params.delete('executiveId');
    }
    setIsZoneOpen(false);
    navigate({
      pathname: '/projects',
      search: params.toString() ? `?${params.toString()}` : ''
    });
  };

  useEffect(() => {
    if (isZoneSwitchLockedForAdmin && isZoneOpen) {
      setIsZoneOpen(false);
    }
  }, [isZoneOpen, isZoneSwitchLockedForAdmin]);

  return (
    <header className="min-h-[70px] lg:h-[110px] flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 lg:px-10 py-3 lg:py-0 sticky top-0 z-40 bg-transparent pointer-events-none">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-8 flex-1 pointer-events-auto">
        {showSidebar && (
          <button
            onClick={toggleSidebar}
            className="shrink-0 p-2.5 sm:p-3 lg:p-4 text-slate-500 hover:text-brand-600 glass-panel rounded-2xl lg:rounded-3xl transition-colors shadow-sm active:scale-95 group border-white/50"
          >
            <PanelLeft className="h-5 w-5 lg:h-6 lg:w-6 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        )}

        <div className="flex-1 min-w-0 flex flex-col hidden sm:flex">
          <div className="flex items-center gap-2 mb-0.5 lg:mb-1">
            <div className="h-1 lg:h-1.5 w-1 lg:w-1.5 rounded-full bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.28)]" />
            <span className="text-[9px] lg:text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] lg:tracking-[0.4em] truncate">{getPageContext()}</span>
          </div>
          <div className="relative group hidden md:block min-w-0">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 lg:h-5 lg:w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Deep Search... (⌘K)"
              className="w-full min-w-0 pl-6 lg:pl-8 pr-4 lg:pr-12 py-1 lg:py-2 bg-transparent text-sm lg:text-lg font-bold text-slate-900 placeholder-slate-300 border-none focus:ring-0 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-3 lg:gap-6 ml-auto pointer-events-auto shrink-0">
          <div className="flex items-center justify-end gap-1.5 lg:gap-5">
          {isOperator && (
            <>
              <div className="relative md:hidden" ref={operatorModeRef}>
                <button
                  type="button"
                  onClick={() => setIsOperatorModeOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700 shadow-sm backdrop-blur-sm active:scale-95"
                  aria-expanded={isOperatorModeOpen}
                >
                  {activeOperatorView.compactLabel}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOperatorModeOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOperatorModeOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {operatorViewOptions.map((option) => (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => handleOperatorViewChange(option.mode, option.path)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors ${
                          operatorViewMode === option.mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="hidden md:inline-flex items-center rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur-sm">
                {operatorViewOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => handleOperatorViewChange(option.mode, option.path)}
                    className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-colors ${operatorViewMode === option.mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {(isEffectiveExecutive || isEffectiveAdmin) && (
            <button
              onClick={() => navigate('/calendar')}
              className="inline-flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-3 rounded-full bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline text-xs lg:text-sm font-semibold">Calendar</span>
            </button>
          )}
          {isExecutiveWorkspaceAdmin ? (
            <div className="relative" ref={zoneRef}>
              <button
                type="button"
                onClick={() => setIsZoneOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-indigo-100 bg-white px-2 sm:px-3 sm:py-2 lg:px-4 lg:py-3 text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
                aria-expanded={isZoneOpen}
                aria-label="Select executive view"
              >
                <User className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="block max-w-[76px] sm:max-w-[145px] truncate text-[10px] sm:text-xs lg:text-sm font-semibold">
                  {selectedExecutive?.name || 'Select executive'}
                </span>
                <ChevronDown className={`hidden sm:block h-4 w-4 text-indigo-500 transition-transform ${isZoneOpen ? 'rotate-180' : ''}`} />
              </button>
              {isZoneOpen && (
                <div className="absolute right-0 mt-2 w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => handleExecutiveViewChange()}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${!selectedExecutiveId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    All executives
                    <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Shared view</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <div className="max-h-72 overflow-y-auto pr-1">
                    {executivesLoading && <p className="px-3 py-3 text-xs font-medium text-slate-500">Loading executives…</p>}
                    {!executivesLoading && executives.length === 0 && <p className="px-3 py-3 text-xs font-medium text-slate-500">No executives found.</p>}
                    {executives.map((executive) => (
                      <button
                        key={executive.id}
                        type="button"
                        onClick={() => handleExecutiveViewChange(executive.id)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${selectedExecutiveId === executive.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <span className="block truncate text-sm font-bold">{executive.name}</span>
                        <span className={`mt-0.5 block truncate text-[11px] font-medium ${selectedExecutiveId === executive.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {executive.email}{executive.zone ? ` · ${formatZoneLabel(executive.zone)}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : canSwitchZone ? (
            <div className="relative group" ref={zoneRef}>
              <button
                onClick={() => {
                  if (isZoneSwitchLockedForAdmin) {
                    return;
                  }
                  setIsZoneOpen(!isZoneOpen);
                }}
                className={`inline-flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-2 lg:px-4 lg:py-3 rounded-full border shadow-sm transition-colors ${
                  isZoneSwitchLockedForAdmin
                    ? 'bg-slate-100/95 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                aria-disabled={isZoneSwitchLockedForAdmin}
              >
                <MapPin className={`h-4 w-4 shrink-0 ${isZoneSwitchLockedForAdmin ? 'text-slate-400' : 'text-indigo-600'}`} />
                <span className="block max-w-[55px] sm:max-w-[92px] truncate text-[10px] sm:text-xs lg:text-sm font-semibold">{formatZoneLabel(activeZone)}</span>
                <ChevronDown className={`hidden sm:block h-4 w-4 transition-transform ${isZoneOpen ? 'rotate-180' : ''}`} />
              </button>
              {isZoneSwitchLockedForAdmin && (
                <div className="pointer-events-none absolute right-0 top-full z-30 mt-3 w-72 rounded-3xl border border-slate-200/80 bg-white/95 p-4 text-left opacity-0 shadow-[0_16px_36px_-20px_rgba(15,23,42,0.28)] transition-opacity duration-150 group-hover:opacity-100">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-800 text-white shadow-lg">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-600">Zone Locked</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">Zone switching is disabled on operational pages for admin.</p>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        Executive, sales, accounts, and installation pages use the shared live workflow view. Switch zones from reporting-oriented pages instead.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {isZoneOpen && !isZoneSwitchLockedForAdmin && (
                <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button
                    onClick={() => {
                      setActiveZone(ALL_ZONES);
                      setIsZoneOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeZone === ALL_ZONES ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    ALL ZONES
                  </button>
                  {VALID_ZONES.map((zone) => (
                    <button
                      key={zone}
                      onClick={() => {
                        setActiveZone(zone);
                        setIsZoneOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeZone === zone ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {formatZoneLabel(zone)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="h-6 lg:h-8 w-px bg-slate-200/60 hidden md:block"></div>

        <div className="relative shrink-0" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`group flex items-center gap-2 sm:gap-3 lg:gap-4 glass-panel p-1 sm:p-1.5 lg:p-2 pr-1 sm:pr-1.5 lg:pr-6 rounded-full lg:rounded-[2rem] shadow-sm transition-colors active:scale-95 border-white/50 ${isProfileOpen ? 'bg-white/92 ring-1 ring-indigo-500/15' : 'hover:bg-white/85'}`}
          >
            <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-11 lg:w-11 rounded-full lg:rounded-[1.25rem] bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 shadow-md transition-shadow">
              <div className="h-full w-full rounded-full lg:rounded-[1.1rem] bg-white overflow-hidden flex items-center justify-center font-black text-indigo-700 text-xs lg:text-sm">
                {user?.avatarUrl ? (
                  <img src={safeDemoImage(user.avatarUrl)} alt={user.name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  user?.name?.charAt(0)
                )}
              </div>
            </div>
            <div className="text-left hidden 2xl:block">
              <p className="text-sm font-black text-slate-900 leading-none">{user?.name?.split(' ')[0]}</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-[0.2em] leading-none">{isDemo ? 'DEMO' : formatRoleLabel(effectiveRole || user?.role)}</p>
            </div>
            <ChevronDown className={`hidden 2xl:block h-4 w-4 text-slate-300 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : 'group-hover:text-slate-600'}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-4 w-[min(20rem,calc(100vw-1rem))] lg:w-80 bg-white/95 rounded-[2rem] lg:rounded-[2.5rem] border border-white/70 shadow-[0_18px_42px_-20px_rgba(0,0,0,0.14)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 origin-top-right ring-1 ring-white/60 p-2">
              <div className="p-5 bg-white/60 rounded-[2rem] border border-white/80 mb-2 flex items-center gap-5 shadow-sm">
                <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-2xl lg:rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center text-lg lg:text-xl font-black shadow-lg overflow-hidden shrink-0">
                  {user?.avatarUrl ? <img src={safeDemoImage(user.avatarUrl)} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : user?.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-900 truncate">{user?.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{user?.email}</p>
                    <div className="flex items-center gap-1.5 mt-2 bg-emerald-50 w-fit px-2 py-0.5 rounded-md border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Node Active</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 p-1">
                {<div className="rounded-2xl bg-amber-50 px-5 py-3 text-xs text-amber-900" role="status">
                  <p className="font-bold">Demo · All records are fictional</p>
                  <button className="mt-2 font-semibold underline" onClick={async () => {
                    const { resetDemoState } = await import('../../demo/store');
                    resetDemoState();
                    window.location.reload();
                  }}>Reset demo data</button>
                </div>}
                <button
                  onClick={handleNavigateToProfile}
                  className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-white/70 hover:bg-white transition-all border border-slate-100 text-slate-800"
                >
                  <span className="text-xs font-black uppercase tracking-[0.2em]">My Profile</span>
                  <User className="h-4 w-4 text-slate-500" />
                </button>
                {(isEffectiveSuperAdmin || isEffectiveOperator) && (
                  <button
                    onClick={handleNavigateToReport}
                    className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-white/70 hover:bg-white transition-all border border-slate-100 text-slate-800"
                  >
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Report</span>
                    <FileText className="h-4 w-4 text-slate-500" />
                  </button>
                )}
                {(isEffectiveAdmin || isEffectiveOperator || isEffectiveSuperAdmin) && (
                  <button
                    onClick={handleNavigateToAuditLogs}
                    className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-white/70 hover:bg-white transition-all border border-slate-100 text-slate-800"
                  >
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Audit Logs</span>
                    <Activity className="h-4 w-4 text-slate-500" />
                  </button>
                )}
                {(isEffectiveAdmin || isEffectiveOperator) && (
                  <button
                    onClick={handleNavigateToTracking}
                    className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-white/70 hover:bg-white transition-all border border-slate-100 text-slate-800"
                  >
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Tracking Dashboard</span>
                    <TableProperties className="h-4 w-4 text-slate-500" />
                  </button>
                )}
              </div>

              <div className="p-2 mt-2">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-between px-6 py-4 bg-slate-950 text-white rounded-[1.75rem] hover:bg-slate-900 transition-all shadow-xl group active:scale-[0.98]"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Terminate Session</span>
                  <LogOut className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
