import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { useOperatorView } from '../context/OperatorViewContext';
import { useToast } from '../context/ToastContext';
import { useZone } from '../context/ZoneContext';
import { auditLogsApi } from '../services/api';
import { AuditActivityCounts, AuditLogRow, AuditCategory } from '../types';
import { RefreshCw } from 'lucide-react';
import { ActorHoverCard, HoveredActorCardState } from '../components/ui/ActorHoverCard';

type AuditTab =
  | 'LOGIN_ACTIVITY'
  | 'PROJECT_VISITING_ACTIVITY'
  | 'PROJECT_ACTIVITY'
  | 'PROJECT_COMPLETION'
  | 'PAYMENT_ACTIVITY'
  | 'DELETION_ACTIVITY'
  | 'PASSWORD_RESET_ACTIVITY';

const TAB_CONFIG: Record<AuditTab, { label: string; category?: AuditCategory; events?: string[] }> = {
  LOGIN_ACTIVITY: { label: 'Login Activity', category: 'LOGIN' },
  PROJECT_VISITING_ACTIVITY: {
    label: 'Project Visits',
    category: 'PROJECT',
    events: ['PROJECT CREATED', 'VISIT SCHEDULED']
  },
  PROJECT_ACTIVITY: {
    label: 'Project Activity',
    category: 'PROJECT',
    events: [
      'PROJECT MOVED',
      'PROJECT UPDATED',
      'SALES DATA UPDATED',
      'INSTALLATION DATA UPDATED',
      'PROJECT FEEDBACK UPDATED'
    ]
  },
  PROJECT_COMPLETION: { label: 'Project Completion', category: 'PROJECT', events: ['PROJECT COMPLETED'] },
  PAYMENT_ACTIVITY: { label: 'Payment Activity', category: 'PROJECT', events: ['PAYMENT RECORDED', 'INVOICE AMOUNT UPDATED'] },
  DELETION_ACTIVITY: { label: 'Deletion Activity', category: 'PROJECT', events: ['DELETION REQUESTED', 'DELETION APPROVED', 'DELETION REJECTED'] },
  PASSWORD_RESET_ACTIVITY: { label: 'Password Reset Activity', category: 'PASSWORD', events: ['PASSWORD_RESET_REQUESTED', 'PASSWORD RESET REQUEST', 'PASSWORD_CHANGED', 'PASSWORD CHANGED'] }
};

const ACTOR_CARD_WIDTH = 288;
const ACTOR_CARD_GAP = 8;
const ACTOR_CARD_SAFE_TOP = 220;
const ACTOR_CARD_VIEWPORT_PADDING = 8;
const AUDIT_TABS = Object.keys(TAB_CONFIG) as AuditTab[];
const INITIAL_COUNTS: AuditActivityCounts = {
  LOGIN_ACTIVITY: 0,
  PROJECT_VISITING_ACTIVITY: 0,
  PROJECT_ACTIVITY: 0,
  PROJECT_COMPLETION: 0,
  PAYMENT_ACTIVITY: 0,
  DELETION_ACTIVITY: 0,
  PASSWORD_RESET_ACTIVITY: 0
};

type AuditTabState = {
  logs: AuditLogRow[];
  page: number;
  totalPages: number;
  totalElements: number;
  loaded: boolean;
};

const EMPTY_TAB_STATE: AuditTabState = {
  logs: [],
  page: 1,
  totalPages: 0,
  totalElements: 0,
  loaded: false
};

const buildInitialTabState = (): Record<AuditTab, AuditTabState> =>
  AUDIT_TABS.reduce((acc, tab) => {
    acc[tab] = { ...EMPTY_TAB_STATE };
    return acc;
  }, {} as Record<AuditTab, AuditTabState>);

const buildInitialLoadingState = (): Record<AuditTab, boolean> =>
  AUDIT_TABS.reduce((acc, tab) => {
    acc[tab] = false;
    return acc;
  }, {} as Record<AuditTab, boolean>);

export const ActivityExplorerPage: React.FC = () => {
  const { user } = useAuth();
  const { isSidebarCollapsed, showSidebar } = useLayout();
  const { effectiveRole } = useOperatorView();
  const { showToast } = useToast();
  const { effectiveZone } = useZone();
  const activeRole = effectiveRole || user?.role;
  const auditZoneFilter = activeRole === 'ROLE_OPERATOR' ? undefined : effectiveZone;

  const [activeTab, setActiveTab] = useState<AuditTab>('LOGIN_ACTIVITY');
  const [tabState, setTabState] = useState<Record<AuditTab, AuditTabState>>(() => buildInitialTabState());
  const [tabLoading, setTabLoading] = useState<Record<AuditTab, boolean>>(() => buildInitialLoadingState());
  const [activityCounts, setActivityCounts] = useState<AuditActivityCounts>(INITIAL_COUNTS);
  const [size] = useState(10);
  const [hoveredActorCard, setHoveredActorCard] = useState<HoveredActorCardState | null>(null);
  const logsRequestId = useRef(0);
  const countsRequestId = useRef(0);

  const activeData = useMemo(() => tabState[activeTab], [tabState, activeTab]);
  const loading = tabLoading[activeTab];

  const loadActivityCounts = useCallback(async () => {
    const requestId = ++countsRequestId.current;
    try {
      const counts = await auditLogsApi.getActivityCounts(auditZoneFilter);
      if (requestId !== countsRequestId.current) return;
      setActivityCounts({
        LOGIN_ACTIVITY: counts.LOGIN_ACTIVITY || 0,
        PROJECT_VISITING_ACTIVITY: counts.PROJECT_VISITING_ACTIVITY || 0,
        PROJECT_ACTIVITY: counts.PROJECT_ACTIVITY || 0,
        PROJECT_COMPLETION: counts.PROJECT_COMPLETION || 0,
        PAYMENT_ACTIVITY: counts.PAYMENT_ACTIVITY || 0,
        DELETION_ACTIVITY: counts.DELETION_ACTIVITY || 0,
        PASSWORD_RESET_ACTIVITY: counts.PASSWORD_RESET_ACTIVITY || 0
      });
    } catch (error: any) {
      if (requestId !== countsRequestId.current) return;
      showToast(error.message || 'Failed to load audit activity counts', 'error');
    }
  }, [auditZoneFilter, showToast]);

  const loadLogs = useCallback(async (tab: AuditTab, targetPage = 1, _force = false) => {
    const config = TAB_CONFIG[tab];
    const requestId = ++logsRequestId.current;
    try {
      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      const rowsRes = await auditLogsApi.getAuditLogs(
        undefined,
        undefined,
        auditZoneFilter,
        config.category,
        config.events,
        targetPage,
        size
      );
      if (requestId !== logsRequestId.current) return;
      setTabState((prev) => ({
        ...prev,
        [tab]: {
          logs: rowsRes.content || [],
          totalPages: rowsRes.totalPages || 0,
          totalElements: rowsRes.totalElements || 0,
          page: (rowsRes.number ?? 0) + 1,
          loaded: true
        }
      }));
    } catch (error: any) {
      if (requestId !== logsRequestId.current) return;
      showToast(error.message || 'Failed to load audit logs', 'error');
    } finally {
      if (requestId === logsRequestId.current) {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    }
  }, [auditZoneFilter, showToast, size]);

  useEffect(() => {
    logsRequestId.current += 1;
    countsRequestId.current += 1;
    setActiveTab('LOGIN_ACTIVITY');
    setTabState(buildInitialTabState());
    setTabLoading(buildInitialLoadingState());
    setActivityCounts(INITIAL_COUNTS);
  }, [auditZoneFilter]);

  useEffect(() => {
    void loadActivityCounts();
  }, [loadActivityCounts]);

  useEffect(() => {
    if (!tabState[activeTab].loaded && !tabLoading[activeTab]) {
      void loadLogs(activeTab, 1);
    }
  }, [activeTab, auditZoneFilter, loadLogs]);

  const handleRefresh = () => {
    void loadLogs(activeTab, activeData.page || 1, true);
    void loadActivityCounts();
  };
  const startNo = (activeData.page - 1) * size + 1;
  const isPaymentActivity = activeTab === 'PAYMENT_ACTIVITY';
  const isLoginActivity = activeTab === 'LOGIN_ACTIVITY';
  const isPasswordActivityTab = activeTab === 'PASSWORD_RESET_ACTIVITY';
  const tableColumnCount = isPaymentActivity ? 7 : isLoginActivity ? 4 : 5;
  const isDeletionEvent = (event: string) => event.startsWith('DELETION ');
  const isDeletionRequestedEvent = (event: string) => event === 'DELETION REQUESTED';
  const isDeletionApprovedEvent = (event: string) => event === 'DELETION APPROVED';
  const isDeletionRejectedEvent = (event: string) => event === 'DELETION REJECTED';
  const isProjectCreatedEvent = (event: string) => event === 'PROJECT CREATED';
  const isVisitScheduledEvent = (event: string) => event === 'VISIT SCHEDULED';
  const isPasswordResetRequestEvent = (event: string) => event === 'PASSWORD_RESET_REQUESTED' || event === 'PASSWORD RESET REQUEST';
  const isPasswordChangedEvent = (event: string) => event === 'PASSWORD_CHANGED' || event === 'PASSWORD CHANGED';
  const getEventLabel = (event: string) => {
    if (isPasswordResetRequestEvent(event)) return 'Password Reset Requested';
    if (isPasswordChangedEvent(event)) return 'Password Changed';
    if (event === 'GOOGLE LOGIN') return 'Google Login';
    if (event === 'USER LOGIN') return 'User Login';
    if (isProjectCreatedEvent(event)) return 'Project Created';
    if (isVisitScheduledEvent(event)) return 'Visit Scheduled';
    return event;
  };
  const getEventColorClass = (event: string) => {
    if (isProjectCreatedEvent(event)) return 'text-green-700';
    if (isVisitScheduledEvent(event)) return 'text-indigo-700';
    if (isPasswordResetRequestEvent(event)) return 'text-red-700';
    if (isPasswordChangedEvent(event)) return 'text-green-700';
    if (isDeletionRequestedEvent(event)) return 'text-amber-700';
    if (isDeletionApprovedEvent(event)) return 'text-green-700';
    if (isDeletionRejectedEvent(event)) return 'text-red-700';
    if (isDeletionEvent(event)) return 'text-gray-900';
    return 'text-gray-900';
  };
  const getCategoryColorClass = (event: string, category: AuditCategory) => {
    if (isDeletionRequestedEvent(event)) return 'bg-amber-100 text-amber-700';
    if (isDeletionApprovedEvent(event)) return 'bg-green-100 text-green-700';
    if (isDeletionRejectedEvent(event)) return 'bg-red-100 text-red-700';
    if (category === 'LOGIN') return 'bg-blue-100 text-blue-700';
    if (category === 'PASSWORD') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-700';
  };
  const formatCurrency = (value?: number) => (value === null || value === undefined) ? '—' : `Rs. ${value.toLocaleString('en-IN')}`;
  const showActorCard = (event: React.MouseEvent<HTMLElement>, actor?: AuditLogRow['actor']) => {
    const anchor = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const left = Math.min(
      Math.max(anchor.left, ACTOR_CARD_VIEWPORT_PADDING),
      Math.max(ACTOR_CARD_VIEWPORT_PADDING, viewportWidth - ACTOR_CARD_WIDTH - ACTOR_CARD_VIEWPORT_PADDING)
    );
    const shouldRenderBelow = anchor.top < ACTOR_CARD_SAFE_TOP;
    const top = shouldRenderBelow ? anchor.bottom + ACTOR_CARD_GAP : anchor.top - ACTOR_CARD_GAP;

    setHoveredActorCard({
      actor,
      top,
      left,
      placement: shouldRenderBelow ? 'bottom' : 'top'
    });
  };

  return (
    <div className="flex min-h-screen mesh-bg relative">
      <div className="glass-canvas" />
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
        <Navbar />

        <div className="px-4 lg:px-12 py-6 lg:py-10 pb-24 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">Audit Logs</h1>
              <p className="text-gray-600 text-sm lg:text-base font-medium">Committed audit events, newest first (up to 2,000 retained records).</p>
            </div>
            <button onClick={handleRefresh} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors font-semibold">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2 sm:gap-3">
              {AUDIT_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-[10px] sm:text-sm font-semibold border transition-colors text-left ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent'
                      : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="truncate">{TAB_CONFIG[tab].label}</div>
                  <div className={`text-base sm:text-lg font-bold mt-1 ${activeTab === tab ? 'text-white' : 'text-gray-900'}`}>{activityCounts[tab] || 0}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-0 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] sm:text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">No.</th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Event</th>
                    {isPaymentActivity ? (
                      <>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Project Name</th>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Amount Received</th>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Pending Amount</th>
                      </>
                    ) : isLoginActivity ? null : (
                      <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Description</th>
                    )}
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Actor</th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {loading ? (
                    <tr><td className="px-4 py-8 text-center text-gray-600" colSpan={tableColumnCount}>Loading audit logs...</td></tr>
                  ) : activeData.logs.length === 0 ? (
                    <tr><td className="px-4 py-8 text-center text-gray-600" colSpan={tableColumnCount}>No audit logs found.</td></tr>
                  ) : (
                    activeData.logs.map((row, idx) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-2 sm:px-4 py-2 sm:py-3">{startNo + idx}</td>
                        <td className={`px-2 sm:px-4 py-2 sm:py-3 font-semibold ${getEventColorClass(row.event)}`}>{getEventLabel(row.event)}</td>
                        {isPaymentActivity ? (
                          <>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-700">{row.projectName || '—'}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-green-700 font-semibold">{formatCurrency(row.amountReceived)}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-red-700 font-semibold">{formatCurrency(row.pendingAmount)}</td>
                          </>
                        ) : isLoginActivity ? null : (
                          <td className={`px-2 sm:px-4 py-2 sm:py-3 ${isPasswordActivityTab || isProjectCreatedEvent(row.event) || isVisitScheduledEvent(row.event) || isDeletionEvent(row.event) ? getEventColorClass(row.event) : 'text-gray-700'}`}>{row.description}</td>
                        )}
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <div
                            className="inline-flex flex-col cursor-pointer"
                            onMouseEnter={(event) => showActorCard(event, row.actor)}
                            onMouseLeave={() => setHoveredActorCard(null)}
                          >
                            <p className="font-semibold text-gray-900">{row.actor?.name || '—'}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500">{row.actor?.email || '—'}</p>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-sm text-gray-700 whitespace-nowrap">{row.timestamp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
              <p className="text-xs text-gray-600">Total: {activeData.totalElements}</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={activeData.page <= 1 || loading}
                  onClick={() => loadLogs(activeTab, activeData.page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600">Page {Math.max(activeData.page, 1)} / {Math.max(activeData.totalPages, 1)}</span>
                <button
                  disabled={activeData.page >= activeData.totalPages || loading || activeData.totalPages === 0}
                  onClick={() => loadLogs(activeTab, activeData.page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ActorHoverCard hoveredActorCard={hoveredActorCard} />
    </div>
  );
};
