import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  LineChart,
  Sparkles,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { ImageConfig } from '../constants/images';
import { safeDemoImage } from '../demo/network';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { useToast } from '../context/ToastContext';
import { useZone } from '../context/ZoneContext';
import { analyticsApi, reportsApi } from '../services/api';
import { Analytics, ProjectTrackingReportRow } from '../types';

const EXECUTIVE_CARD_WIDTH = 288;
const EXECUTIVE_CARD_GAP = 8;
const EXECUTIVE_CARD_SAFE_TOP = 220;
const EXECUTIVE_CARD_VIEWPORT_PADDING = 8;

type HoveredExecutiveCardState = {
  executiveName: string;
  executiveEmail?: string;
  executiveAvatarUrl?: string;
  top: number;
  left: number;
  placement: 'top' | 'bottom';
};

type HoveredProjectCardState = {
  row: ProjectTrackingReportRow;
  top: number;
  left: number;
  placement: 'top' | 'bottom';
};

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const normalizeMonthLabel = (monthValue?: string) => {
  if (!monthValue) return 'Unknown';
  const trimmed = monthValue.trim();
  const monthNumberMatch = trimmed.match(/^Month\s+(\d{1,2})$/i);
  if (monthNumberMatch) {
    const monthNumber = Number(monthNumberMatch[1]);
    if (monthNumber >= 1 && monthNumber <= 12) {
      return MONTH_OPTIONS[monthNumber - 1];
    }
  }
  const monthIndex = MONTH_OPTIONS.findIndex((month) => month.toLowerCase().startsWith(trimmed.toLowerCase()));
  if (monthIndex >= 0) {
    return MONTH_OPTIONS[monthIndex];
  }
  return trimmed;
};

const formatZoneLabel = (zone?: string) => {
  if (!zone) return '-';
  return zone.replace(/_/g, ' ');
};

export const ReportsPage: React.FC = () => {
  const { isSidebarCollapsed, showSidebar } = useLayout();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { effectiveZone, isSuperAdmin } = useZone();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [projectReportRows, setProjectReportRows] = useState<ProjectTrackingReportRow[]>([]);
  const [hoveredExecutiveCard, setHoveredExecutiveCard] = useState<HoveredExecutiveCardState | null>(null);
  const [hoveredProjectCard, setHoveredProjectCard] = useState<HoveredProjectCardState | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = !hasLoadedOnceRef.current;
    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    const loadData = async () => {
      try {
        const [analyticsResult, reportsResult] = await Promise.allSettled([
          analyticsApi.getDashboardAnalytics(effectiveZone),
          reportsApi.getReports(effectiveZone)
        ]);
        if (cancelled) return;
        if (analyticsResult.status === 'fulfilled') {
          setAnalytics(analyticsResult.value);
        } else {
          showToast('Analytics service unavailable; showing project-based report data', 'error');
          setAnalytics({
            totalProjects: 0,
            activeProjects: 0,
            completedProjects: 0,
            successRate: 0,
            financialSummary: { totalRevenue: 0, completedRevenue: 0, pendingRevenue: 0, totalReceived: 0, totalPending: 0 },
            stageDistribution: [],
            monthlyTrends: [],
            projectsThisMonth: 0,
            completedThisMonth: 0,
            revenueThisMonth: 0
          });
        }
        if (reportsResult.status === 'fulfilled') {
          setProjectReportRows(reportsResult.value);
        } else {
          setProjectReportRows([]);
        }
      } catch (error) {
        if (cancelled) return;
        showToast('Failed to load analytics data', 'error');
        console.error('Analytics fetch error:', error);
      } finally {
        if (cancelled) return;
        hasLoadedOnceRef.current = true;
        if (initialLoad) {
          setIsLoading(false);
          setHasLoadedOnce(true);
        } else {
          setIsRefreshing(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [effectiveZone, isSuperAdmin, showToast]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

  const formatCompactCurrency = (num: number) => {
    if (num >= 10000000) return `Rs ${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `Rs ${(num / 100000).toFixed(2)}L`;
    return formatCurrency(num);
  };

  const formatDate = (date?: string) => (date ? date.slice(0, 10) : '-');
  const showExecutiveCard = (
    event: React.MouseEvent<HTMLElement>,
    executiveName?: string,
    executiveEmail?: string,
    executiveAvatarUrl?: string
  ) => {
    if (!executiveName) {
      setHoveredExecutiveCard(null);
      return;
    }
    const anchor = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const left = Math.min(
      Math.max(anchor.left, EXECUTIVE_CARD_VIEWPORT_PADDING),
      Math.max(EXECUTIVE_CARD_VIEWPORT_PADDING, viewportWidth - EXECUTIVE_CARD_WIDTH - EXECUTIVE_CARD_VIEWPORT_PADDING)
    );
    const shouldRenderBelow = anchor.top < EXECUTIVE_CARD_SAFE_TOP;
    const top = shouldRenderBelow ? anchor.bottom + EXECUTIVE_CARD_GAP : anchor.top - EXECUTIVE_CARD_GAP;
    setHoveredExecutiveCard({
      executiveName,
      executiveEmail,
      executiveAvatarUrl,
      top,
      left,
      placement: shouldRenderBelow ? 'bottom' : 'top'
    });
  };

  const showProjectCard = (
    event: React.MouseEvent<HTMLElement>,
    row: ProjectTrackingReportRow
  ) => {
    const anchor = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const left = Math.min(
      Math.max(anchor.left, EXECUTIVE_CARD_VIEWPORT_PADDING),
      Math.max(EXECUTIVE_CARD_VIEWPORT_PADDING, viewportWidth - EXECUTIVE_CARD_WIDTH - EXECUTIVE_CARD_VIEWPORT_PADDING)
    );
    const shouldRenderBelow = anchor.top < EXECUTIVE_CARD_SAFE_TOP;
    const top = shouldRenderBelow ? anchor.bottom + EXECUTIVE_CARD_GAP : anchor.top - EXECUTIVE_CARD_GAP;
    setHoveredProjectCard({
      row,
      top,
      left,
      placement: shouldRenderBelow ? 'bottom' : 'top'
    });
  };

  const isAwaitingAccounts = (row: ProjectTrackingReportRow) =>
    (row.stage || '').toUpperCase() === 'SALES' && (row.invoiceAmount || 0) > 0;

  const getPaymentStatusLabel = (row: ProjectTrackingReportRow) => {
    if (isAwaitingAccounts(row)) {
      return 'AWAITING ACCOUNTS';
    }
    if (row.paymentStatus === 'PENDING_INPUT') {
      return 'PENDING INPUT';
    }
    return row.paymentStatus || 'RED';
  };

  const getPaymentExplanation = (row: ProjectTrackingReportRow) => {
    if (isAwaitingAccounts(row)) {
      return 'Invoice entered in sales; accounts processing has not started yet.';
    }
    if (row.paymentStatus === 'PENDING_INPUT') {
      return 'Invoice amount is not entered yet.';
    }
    return null;
  };

  const getPendingClass = (status?: string) => {
    switch (status) {
      case 'GREEN':
        return 'text-emerald-700 bg-emerald-50';
      case 'YELLOW':
        return 'text-amber-700 bg-amber-50';
      case 'PENDING_INPUT':
        return 'text-slate-700 bg-slate-100';
      default:
        return 'text-rose-700 bg-rose-50';
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'GREEN':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'YELLOW':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'PENDING_INPUT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const formatStageLabel = (stage?: string) => {
    if (!stage) return '-';
    return stage.replace(/_/g, ' ');
  };

  const isSameMonth = (value?: string, monthOffset = 0) => {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return parsed.getFullYear() === target.getFullYear() && parsed.getMonth() === target.getMonth();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen mesh-bg relative">
        <div className="glass-canvas" />
        <Sidebar />
        <div className={`flex-1 flex items-center justify-center transition-all duration-500 ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
          <ReportsSkeleton />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex min-h-screen mesh-bg relative">
        <div className="glass-canvas" />
        <Sidebar />
        <div className={`flex-1 flex items-center justify-center transition-all duration-500 ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
          <div className="premium-surface rounded-[2rem] px-8 py-10 text-center">
            <p className="text-slate-700 font-semibold">No data available.</p>
          </div>
        </div>
      </div>
    );
  }

  const invoiceRevenueTotal = projectReportRows.reduce((sum, row) => sum + (row.invoiceAmount || 0), 0);
  const projectValueTotal = projectReportRows.reduce((sum, row) => sum + (row.projectValue || 0), 0);
  const financeStreamRows = projectReportRows.filter((row) => {
    const stage = (row.stage || '').toUpperCase();
    const hasInvoice = (row.invoiceAmount || 0) > 0;
    return hasInvoice && (stage === 'SALES' || stage === 'ACCOUNTS');
  });
  const invoiceTrendSeries = analytics.monthlyTrends;
  const currentMonthInvoiceRevenue = invoiceTrendSeries[invoiceTrendSeries.length - 1]?.revenue || 0;
  const previousMonthInvoiceRevenue = invoiceTrendSeries[invoiceTrendSeries.length - 2]?.revenue || 0;
  const currentMonthProjectValue = projectReportRows
    .filter((row) => isSameMonth(row.stageChangedAt, 0))
    .reduce((sum, row) => sum + (row.projectValue || 0), 0);
  const comparison = {
    current: currentMonthInvoiceRevenue,
    previous: previousMonthInvoiceRevenue,
    currentProjects: invoiceTrendSeries[invoiceTrendSeries.length - 1]?.projectCount || 0,
    previousProjects: invoiceTrendSeries[invoiceTrendSeries.length - 2]?.projectCount || 0,
    change: previousMonthInvoiceRevenue > 0 ? ((currentMonthInvoiceRevenue - previousMonthInvoiceRevenue) / previousMonthInvoiceRevenue) * 100 : 0,
    isUp: currentMonthInvoiceRevenue >= previousMonthInvoiceRevenue,
    currentMonth: normalizeMonthLabel(MONTH_OPTIONS[new Date().getMonth()]),
    previousMonth: normalizeMonthLabel(MONTH_OPTIONS[(new Date().getMonth() + 11) % 12])
  };
  const projectsComp = {
    change: comparison.previousProjects > 0 ? ((comparison.currentProjects - comparison.previousProjects) / comparison.previousProjects) * 100 : 0,
    isUp: comparison.currentProjects >= comparison.previousProjects
  };
  const snapshotTotalPending = projectReportRows.reduce((sum, row) => sum + (row.pendingAmount || 0), 0);
  const uniqueSnapshotProjects = new Set(projectReportRows.map((row) => row.projectId)).size;
  const trendPeak = Math.max(...invoiceTrendSeries.map((row) => row.revenue), 0);
  const zoneSummary = ['ZONE_1', 'ZONE_2', 'ZONE_3'].map((zone) => {
    const rows = projectReportRows.filter((row) => row.zone === zone);
    const pending = rows.reduce((sum, row) => sum + (row.pendingAmount || 0), 0);
    return { zone, count: rows.length, pending };
  });
  const pendingFinanceProjectCount = financeStreamRows.filter((row) =>
    isAwaitingAccounts(row) || (row.pendingAmount || 0) > 0
  ).length;

  return (
    <div className="flex min-h-screen mesh-bg relative overflow-hidden">
      <div className="glass-canvas" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[12%] h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute top-[28rem] right-[8%] h-96 w-96 rounded-full bg-fuchsia-200/20 blur-3xl" />
        <div className="absolute bottom-0 left-[28%] h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>
      <Sidebar />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
        <Navbar />

        <div className={`px-4 lg:px-12 py-6 lg:py-10 pb-28 space-y-6 lg:space-y-8 superadmin-page-enter ${isRefreshing ? 'superadmin-page-refresh' : ''}`}>
          <section className="premium-surface rounded-[2.25rem] p-6 lg:p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),transparent_48%,rgba(15,23,42,0.08))]" />
            <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                  <span>Reporting Atelier</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{effectiveZone || 'ALL_ZONES'}</span>
                </div>
                <div>
                  <h1 className="premium-heading text-3xl lg:text-5xl font-bold text-slate-950">
                    Performance reporting for review.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm lg:text-base leading-7 text-slate-600">
                    Revenue is now led by invoice amount, while project value remains visible as a supporting signal for context.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/60 bg-white/55 px-4 py-2 text-xs font-semibold text-slate-700">
                    Completed invoice revenue: {formatCompactCurrency(invoiceRevenueTotal)}
                  </div>
                  <div className="rounded-full border border-white/60 bg-white/45 px-4 py-2 text-xs font-semibold text-slate-700">
                    Project value: {formatCompactCurrency(projectValueTotal)}
                  </div>
                  <div className={`rounded-full px-4 py-2 text-xs font-semibold ${comparison.isUp ? 'border border-emerald-200 bg-emerald-50/70 text-emerald-700' : 'border border-rose-200 bg-rose-50/70 text-rose-700'}`}>
                    Revenue trend {comparison.isUp ? 'up' : 'down'} {Math.abs(comparison.change).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-white/60 bg-slate-950/[0.84] p-5 lg:p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-sky-200/80">Revenue focus</p>
                    <h2 className="premium-heading mt-2 text-2xl font-bold">Monthly Duel</h2>
                  </div>
                  {comparison.isUp ? <TrendingUp className="h-6 w-6 text-emerald-300" /> : <TrendingDown className="h-6 w-6 text-rose-300" />}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{comparison.currentMonth}</p>
                    <p className="premium-heading mt-3 text-3xl font-bold">{formatCompactCurrency(comparison.current)}</p>
                    <p className="mt-2 text-xs text-slate-400">Project value {formatCompactCurrency(currentMonthProjectValue)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{comparison.previousMonth}</p>
                    <p className="premium-heading mt-3 text-3xl font-bold">{formatCompactCurrency(comparison.previous)}</p>
                    <p className="mt-2 text-xs text-slate-400">{comparison.previousProjects} projects</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-sky-500/10 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-300">Movement</span>
                  <span className={`flex items-center gap-2 text-sm font-bold ${comparison.isUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {comparison.isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {comparison.isUp ? '+' : '-'}{Math.abs(comparison.change).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricRibbon label="Completed Revenue" value={formatCompactCurrency(invoiceRevenueTotal)} detail={`${uniqueSnapshotProjects} unique projects`} icon={DollarSign} />
            <MetricRibbon label="Current Month Revenue" value={formatCompactCurrency(currentMonthInvoiceRevenue)} detail={`${comparison.currentProjects} project entries`} icon={Calendar} />
            <MetricRibbon label="Project Value" value={formatCompactCurrency(projectValueTotal)} detail="Supporting valuation signal" icon={Sparkles} />
            <MetricRibbon label="Project Movement" value={`${projectsComp.isUp ? '+' : ''}${projectsComp.change.toFixed(1)}%`} detail={`${comparison.currentProjects} vs ${comparison.previousProjects} projects`} icon={LineChart} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="premium-surface rounded-[2rem] p-6 lg:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Six month trajectory</p>
                  <h2 className="premium-heading mt-2 text-2xl font-bold text-slate-950">Invoice Monthly Bar Graph</h2>
                </div>
                <div className="text-sm font-semibold text-slate-600">
                  Peak: {formatCompactCurrency(trendPeak)}
                </div>
              </div>
              <div className="mt-6 grid min-h-[14rem] grid-cols-2 gap-2 rounded-2xl border border-white/60 bg-white/45 p-2 sm:mt-8 sm:min-h-[18rem] sm:grid-cols-3 sm:gap-3 sm:rounded-[1.8rem] sm:p-4 lg:grid-cols-6">
                {invoiceTrendSeries.length > 0 ? invoiceTrendSeries.map((month, index) => {
                  const height = trendPeak > 0 ? Math.max((month.revenue / trendPeak) * 100, month.revenue > 0 ? 12 : 4) : 8;
                  const isLatest = index === invoiceTrendSeries.length - 1;
                  return (
                    <div key={`${month.month}-${index}`} className="flex min-w-0 flex-col gap-3">
                      <div className="text-center text-[11px] font-bold text-slate-500">{formatCompactCurrency(month.revenue)}</div>
                      <div className="flex h-44 items-end rounded-[1.4rem] bg-slate-100/80 px-3 py-3">
                        <div
                          className={`w-full rounded-t-[1rem] shadow-[0_12px_24px_-16px_rgba(15,23,42,0.7)] ${isLatest ? 'bg-gradient-to-t from-slate-950 via-sky-700 to-cyan-400' : 'bg-gradient-to-t from-slate-400 via-slate-200 to-white'}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="truncate text-xs font-bold text-slate-700">{normalizeMonthLabel(month.month)}</p>
                        <p className="text-[11px] text-slate-500">{month.projectCount} projects</p>
                      </div>
                    </div>
                  );
                }) : <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No monthly revenue trend available.</div>}
              </div>
            </div>

            <div className="premium-surface rounded-[2rem] p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="rounded-[1.2rem] border border-white/60 bg-white/50 p-3">
                  <LineChart className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Core signals</p>
                  <h2 className="premium-heading text-2xl font-bold text-slate-950">Performance Notes</h2>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <InsightRow label="Invoice delta" value={`${comparison.isUp ? '+' : ''}${comparison.change.toFixed(1)}%`} tone={comparison.isUp ? 'positive' : 'negative'} />
                <InsightRow label="Project delta" value={`${projectsComp.isUp ? '+' : ''}${projectsComp.change.toFixed(1)}%`} tone={projectsComp.isUp ? 'positive' : 'negative'} />
                <InsightRow label="Pending exposure" value={formatCompactCurrency(snapshotTotalPending)} tone="neutral" />
                <InsightRow label="Project value" value={formatCompactCurrency(projectValueTotal)} tone="neutral" />
              </div>
            </div>
          </section>

          <section className="premium-surface rounded-[2rem] p-6 lg:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Reporting surface</p>
                <h2 className="premium-heading mt-2 text-2xl font-bold text-slate-950">Project Finance Stream</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-white/60 bg-white/55 px-4 py-2 text-xs font-semibold text-slate-700">
                  Rows: {financeStreamRows.length}
                </div>
                <div className="rounded-full border border-white/60 bg-white/45 px-4 py-2 text-xs font-semibold text-slate-700">
                  Pending projects: {pendingFinanceProjectCount}
                </div>
                <div className="rounded-full border border-rose-200 bg-rose-50/70 px-4 py-2 text-xs font-semibold text-rose-700">
                  Pending total: {formatCompactCurrency(snapshotTotalPending)}
                </div>
              </div>
            </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {zoneSummary.map((entry) => (
                  <div key={entry.zone} className="rounded-[1.5rem] border border-white/60 bg-white/45 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{formatZoneLabel(entry.zone)}</p>
                    <p className="premium-heading mt-3 text-2xl font-bold text-slate-950">{entry.count}</p>
                    <p className="mt-2 text-sm text-slate-600">Pending {formatCompactCurrency(entry.pending)}</p>
                  </div>
                ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-white/60 bg-white/55">
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-sm xl:text-[14px] 2xl:text-[15px] [@media(min-width:2200px)]:text-base">
                  <thead className="bg-white/70 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-4 text-left 2xl:px-5 [@media(min-width:2200px)]:px-6">S.No</th>
                      <th className="px-4 py-4 text-left 2xl:px-5 [@media(min-width:2200px)]:px-6">Customer</th>
                      <th className="px-4 py-4 text-left 2xl:px-5 [@media(min-width:2200px)]:px-6">Project</th>
                      <th className="px-4 py-4 text-right whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">Project Value</th>
                      <th className="px-4 py-4 text-right whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">Invoice</th>
                      <th className="px-4 py-4 text-right whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">Pending</th>
                      <th className="px-4 py-4 text-left whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">Created Date</th>
                      <th className="px-4 py-4 text-left 2xl:px-5 [@media(min-width:2200px)]:px-6">Created By</th>
                      <th className="px-4 py-4 text-left whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">Status</th>
                      <th className="px-4 py-4 text-left whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeStreamRows.map((row, index) => (
                      <tr key={`${row.projectId}-${row.stageChangedAt || 'na'}`} className="border-t border-slate-200/70 text-slate-700">
                        <td className="px-4 py-4 font-semibold text-slate-500 2xl:px-5 [@media(min-width:2200px)]:px-6">{index + 1}</td>
                        <td className="px-4 py-4 2xl:px-5 [@media(min-width:2200px)]:px-6">
                          <div className="max-w-[200px] truncate font-medium text-slate-800 2xl:max-w-[320px] [@media(min-width:2200px)]:max-w-[420px]">
                            {row.customerName || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 2xl:px-5 [@media(min-width:2200px)]:px-6">
                          <span
                            className="inline-flex max-w-[220px] cursor-pointer truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-900 2xl:max-w-[360px] 2xl:px-4 2xl:text-sm [@media(min-width:2200px)]:max-w-[460px]"
                            onMouseEnter={(event) => showProjectCard(event, row)}
                            onMouseLeave={() => setHoveredProjectCard(null)}
                          >
                            {row.projectName || `#${row.projectId}`}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">{formatCompactCurrency(row.projectValue || 0)}</td>
                        <td className="px-4 py-4 text-right font-bold text-slate-950 whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">{formatCompactCurrency(row.invoiceAmount || 0)}</td>
                        <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6 ${getPendingClass(isAwaitingAccounts(row) ? 'PENDING_INPUT' : row.paymentStatus)}`}>
                          <div>{formatCompactCurrency(row.pendingAmount || 0)}</div>
                          {getPaymentExplanation(row) && (
                            <div className="mt-1 text-[10px] font-medium text-slate-500 2xl:text-[11px]">
                              {isAwaitingAccounts(row) ? 'Awaiting accounts' : 'Pending input'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">{formatDate(row.createdDate)}</td>
                        <td className="px-4 py-4 2xl:px-5 [@media(min-width:2200px)]:px-6">
                          <span
                            className="inline-flex max-w-[180px] cursor-pointer truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 2xl:max-w-[260px] 2xl:px-4 2xl:text-sm [@media(min-width:2200px)]:max-w-[320px]"
                            onMouseEnter={(event) => showExecutiveCard(event, row.executiveName, row.executiveEmail, row.executiveAvatarUrl)}
                            onMouseLeave={() => setHoveredExecutiveCard(null)}
                          >
                            {row.executiveName || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold 2xl:px-3 2xl:py-1.5 2xl:text-xs ${getStatusBadgeClass(isAwaitingAccounts(row) ? 'PENDING_INPUT' : row.paymentStatus)}`}>
                            {getPaymentStatusLabel(row)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap 2xl:px-5 [@media(min-width:2200px)]:px-6">{formatZoneLabel(row.zone)}</td>
                      </tr>
                    ))}
                    {financeStreamRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>No project rows found for the current zone.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>
      </div>
      <ExecutiveHoverCard hoveredExecutiveCard={hoveredExecutiveCard} />
      <ProjectHoverCard
        hoveredProjectCard={hoveredProjectCard}
        formatCompactCurrency={formatCompactCurrency}
        formatDate={formatDate}
        formatStageLabel={formatStageLabel}
        getPaymentStatusLabel={getPaymentStatusLabel}
        getPaymentExplanation={getPaymentExplanation}
      />
    </div>
  );
};

const MetricRibbon = ({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="premium-surface rounded-[2rem] p-5 lg:p-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
        <p className="premium-heading mt-3 text-3xl font-bold text-slate-950">{value}</p>
        <p className="mt-3 text-sm text-slate-600">{detail}</p>
      </div>
      <div className="rounded-[1.2rem] border border-white/60 bg-white/55 p-3">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
    </div>
  </div>
);

const InsightRow = ({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
}) => {
  const toneClass = tone === 'positive'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'negative'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-white/55 text-slate-700 border-white/60';

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">{label}</span>
        <span className="premium-heading text-2xl font-bold">{value}</span>
      </div>
    </div>
  );
};

const ReportsSkeleton = () => (
  <div className="w-full max-w-6xl space-y-6 px-4 lg:px-8">
    <div className="premium-surface rounded-[2.25rem] p-6 lg:p-8 animate-pulse">
      <div className="h-3 w-40 rounded-full bg-white/60" />
      <div className="mt-5 h-12 w-3/4 rounded-2xl bg-white/60" />
      <div className="mt-4 h-5 w-1/2 rounded-xl bg-white/50" />
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
      </div>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="premium-surface h-80 rounded-[2rem] animate-pulse" />
      <div className="premium-surface h-80 rounded-[2rem] animate-pulse" />
    </div>
    <div className="premium-surface h-96 rounded-[2rem] animate-pulse" />
  </div>
);

const ExecutiveHoverCard = ({
  hoveredExecutiveCard
}: {
  hoveredExecutiveCard: HoveredExecutiveCardState | null;
}) => {
  if (!hoveredExecutiveCard) return null;

  const avatarSrc = safeDemoImage(hoveredExecutiveCard.executiveAvatarUrl || ImageConfig.logo);

  return createPortal(
    <div
      className="pointer-events-none fixed w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-100"
      style={{
        top: hoveredExecutiveCard.top,
        left: hoveredExecutiveCard.left,
        zIndex: 1200,
        transform: hoveredExecutiveCard.placement === 'top' ? 'translateY(-100%)' : undefined
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Created By Executive</p>
      <div className="mt-4 flex items-start gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <img
            src={avatarSrc}
            alt={hoveredExecutiveCard.executiveName}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="premium-heading text-2xl font-bold text-slate-950 break-words">{hoveredExecutiveCard.executiveName}</p>
          <p className="mt-1 text-sm text-slate-600 break-all">{hoveredExecutiveCard.executiveEmail || 'No email available'}</p>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ProjectHoverCard = ({
  hoveredProjectCard,
  formatCompactCurrency,
  formatDate,
  formatStageLabel,
  getPaymentStatusLabel,
  getPaymentExplanation
}: {
  hoveredProjectCard: HoveredProjectCardState | null;
  formatCompactCurrency: (amount: number) => string;
  formatDate: (date?: string) => string;
  formatStageLabel: (stage?: string) => string;
  getPaymentStatusLabel: (row: ProjectTrackingReportRow) => string;
  getPaymentExplanation: (row: ProjectTrackingReportRow) => string | null;
}) => {
  if (!hoveredProjectCard) return null;

  const { row } = hoveredProjectCard;

  return createPortal(
    <div
      className="pointer-events-none fixed w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-100"
      style={{
        top: hoveredProjectCard.top,
        left: hoveredProjectCard.left,
        zIndex: 1200,
        transform: hoveredProjectCard.placement === 'top' ? 'translateY(-100%)' : undefined
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Project Finance Detail</p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="premium-heading text-xl font-bold text-slate-950 break-words">{row.projectName || `#${row.projectId}`}</p>
          <p className="mt-1 text-sm text-slate-600 break-words">{row.customerName || 'No customer available'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Stage</p>
            <p className="mt-1 font-semibold text-slate-900">{formatStageLabel(row.stage)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Zone</p>
            <p className="mt-1 font-semibold text-slate-900">{row.zone || '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Invoice</p>
            <p className="mt-1 font-semibold text-slate-900">{formatCompactCurrency(row.invoiceAmount || 0)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pending</p>
            <p className="mt-1 font-semibold text-slate-900">{formatCompactCurrency(row.pendingAmount || 0)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Finance Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{getPaymentStatusLabel(row)}</p>
          {getPaymentExplanation(row) && (
            <p className="mt-2 text-xs leading-5 text-slate-600">{getPaymentExplanation(row)}</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>Created {formatDate(row.createdDate)}</span>
          <span>Project ID #{row.projectId}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
