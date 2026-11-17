import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Layers3,
  PieChart,
  Sparkles,
  Info
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { useOperatorView } from '../context/OperatorViewContext';
import { useToast } from '../context/ToastContext';
import { useZone } from '../context/ZoneContext';
import { analyticsApi, reportsApi } from '../services/api';
import { Analytics, ProjectTrackingReportRow } from '../types';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRevenue: number;
  pendingRevenue: number;
  projectsByStage: Record<string, number>;
  monthlyTrend: Array<{ month: string; revenue: number; projects: number }>;
  statusInsights: {
    paymentActivity: { red: number; yellow: number; green: number };
    salesUpdation: { red: number; yellow: number; green: number };
    accounts: { red: number; yellow: number; green: number };
    executive: { red: number; yellow: number; green: number };
  };
  productionSummary: {
    currentMonthQuantity: number;
    yearToDateQuantity: number;
    monthlyProductionTrend: number;
    recentEntries: Array<{ productName: string; category: string; quantity: number; timestamp?: string }>;
    topProductsThisMonth: Array<{ name: string; quantity: number }>;
  };
}

const emptyStatus = { red: 0, yellow: 0, green: 0 };

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isSidebarCollapsed, showSidebar } = useLayout();
  const { effectiveRole } = useOperatorView();
  const { activeZone, effectiveZone, isSuperAdmin } = useZone();
  const { showToast } = useToast();
  const activeRole = effectiveRole || user?.role;
  const canLoadReportRows = activeRole === 'ROLE_SUPER_ADMIN' || activeRole === 'ROLE_ADMIN';
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reportRows, setReportRows] = useState<ProjectTrackingReportRow[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    projectsByStage: {},
    monthlyTrend: [],
    statusInsights: {
      paymentActivity: emptyStatus,
      salesUpdation: emptyStatus,
      accounts: emptyStatus,
      executive: emptyStatus
    },
    productionSummary: {
      currentMonthQuantity: 0,
      yearToDateQuantity: 0,
      monthlyProductionTrend: 0,
      recentEntries: [],
      topProductsThisMonth: []
    }
  });

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
        const [analyticsData, reportsData] = await Promise.all([
          analyticsApi.getDashboardAnalytics(effectiveZone),
          canLoadReportRows ? reportsApi.getReports(effectiveZone) : Promise.resolve([])
        ]);
        if (cancelled) return;
        setAnalytics(analyticsData);
        setReportRows(reportsData);

        const projectsByStage: Record<string, number> = {};
        analyticsData.stageDistribution.forEach((stage) => {
          projectsByStage[stage.stage] = stage.count;
        });

        setStats({
          totalProjects: analyticsData.totalProjects,
          activeProjects: analyticsData.activeProjects,
          completedProjects: analyticsData.completedProjects,
          totalRevenue: analyticsData.financialSummary.totalRevenue,
          pendingRevenue: analyticsData.financialSummary.pendingRevenue,
          projectsByStage,
          monthlyTrend: analyticsData.monthlyTrends.map((trend) => ({
            month: trend.month,
            revenue: trend.revenue,
            projects: trend.projectCount
          })),
          statusInsights: {
            paymentActivity: analyticsData.statusInsights?.paymentActivity || emptyStatus,
            salesUpdation: analyticsData.statusInsights?.salesUpdation || emptyStatus,
            accounts: analyticsData.statusInsights?.accounts || emptyStatus,
            executive: analyticsData.statusInsights?.executive || emptyStatus
          },
          productionSummary: {
            currentMonthQuantity: analyticsData.productionSummary?.currentMonthQuantity || 0,
            yearToDateQuantity: analyticsData.productionSummary?.yearToDateQuantity || 0,
            monthlyProductionTrend: analyticsData.productionSummary?.monthlyProductionTrend || 0,
            recentEntries: (analyticsData.productionSummary?.recentEntries || []).map((entry) => ({
              productName: entry.productName,
              category: entry.category,
              quantity: entry.quantity,
              timestamp: entry.timestamp
            })),
            topProductsThisMonth: Object.entries(analyticsData.productionSummary?.topProductsThisMonth || {}).map(([name, quantity]) => ({
              name,
              quantity
            }))
          }
        });
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
  }, [canLoadReportRows, effectiveZone, showToast]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `Rs ${(amount / 100000).toFixed(2)}L`;
    return formatCurrency(amount);
  };

  const formatStageName = (stage: string) => stage.replace(/_/g, ' ');

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = user?.name?.split(' ')[0] || 'User';
  const stageEntries = (Object.entries(stats.projectsByStage) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1]);
  const stagePeak = Math.max(...stageEntries.map(([, count]) => count), 0);
  const pendingFeedbackProjects = analytics?.pendingFeedbackProjects || 0;
  const pendingFeedbackShare = stats.completedProjects > 0
    ? (pendingFeedbackProjects / stats.completedProjects) * 100
    : 0;
  const successRate = stats.totalProjects > 0 ? (stats.completedProjects / stats.totalProjects) * 100 : 0;
  const invoiceRevenueTotal = reportRows.reduce((sum, row) => sum + (row.invoiceAmount || 0), 0);
  const projectValueTotal = reportRows.reduce((sum, row) => sum + (row.projectValue || 0), 0);
  const financeBacklogRows = reportRows.filter((row) => {
    const stage = (row.stage || '').toUpperCase();
    const hasInvoice = (row.invoiceAmount || 0) > 0;
    return hasInvoice && (stage === 'SALES' || stage === 'ACCOUNTS');
  });
  const pendingFinanceProjectCount = financeBacklogRows.filter((row) => {
    const stage = (row.stage || '').toUpperCase();
    return stage === 'SALES' || (row.pendingAmount || 0) > 0;
  }).length;
  const pendingRevenueTotal = stats.pendingRevenue;
  const trendSeries = stats.monthlyTrend;
  const latestTrend = trendSeries[trendSeries.length - 1];
  const previousTrend = trendSeries[trendSeries.length - 2];
  const currentMonthInvoiceRevenue = latestTrend?.revenue || 0;
  const previousMonthInvoiceRevenue = previousTrend?.revenue || 0;
  const primaryRevenueTotal = stats.totalRevenue;
  const collectedRevenueTotal = analytics?.financialSummary.totalReceived || 0;
  const primaryCurrentMonthRevenue = analytics?.revenueThisMonth || 0;
  const revenuePerProject = stats.totalProjects > 0 ? primaryRevenueTotal / stats.totalProjects : 0;
  const trendShift = previousTrend && previousTrend.revenue > 0
    ? ((latestTrend.revenue - previousTrend.revenue) / previousTrend.revenue) * 100
    : canLoadReportRows && previousMonthInvoiceRevenue > 0
      ? ((currentMonthInvoiceRevenue - previousMonthInvoiceRevenue) / previousMonthInvoiceRevenue) * 100
      : 0;
  const trendPeak = Math.max(...trendSeries.map((item) => item.revenue), 0);
  const creationLimitStatus = analytics?.projectCreationLimitStatus;
  const isProjectCreationBlocked = Boolean(creationLimitStatus?.creationBlocked);
  const limitAudienceLabel = isSuperAdmin ? 'Super Admin Alert' : 'Admin Alert';

  const spotlightMetrics = [
    {
      label: 'Invoiced Revenue',
      value: formatCompactCurrency(primaryRevenueTotal),
      detail: canLoadReportRows
        ? `Project value ${formatCompactCurrency(projectValueTotal)}`
        : `${stats.completedProjects} completed conversions`,
      icon: IndianRupee,
      accent: 'from-cyan-500/30 via-sky-500/15 to-transparent'
    },
    {
      label: 'Active Projects',
      value: `${stats.activeProjects}`,
      detail: `${stats.totalProjects} Total Projects`,
      icon: Layers3,
      accent: 'from-amber-500/30 via-orange-500/15 to-transparent'
    },
    {
      label: 'Completion Rate',
      value: `${successRate.toFixed(1)}%`,
      detail: `Average revenue ${formatCompactCurrency(revenuePerProject)}`,
      icon: Sparkles,
      accent: 'from-emerald-500/30 via-lime-500/15 to-transparent'
    }
  ];

  const statusStreams = [
    { 
      title: 'Payment Activity', 
      data: stats.statusInsights.paymentActivity,
      description: 'Tracks pending balances for Accounts projects. Red indicates a pending balance with no activity for >20 days.'
    },
    { 
      title: 'Sales Updation', 
      data: stats.statusInsights.salesUpdation,
      description: 'Measures how fresh Sales projects are. Red indicates no sales updates in >20 days.'
    },
    { 
      title: 'Accounts', 
      data: stats.statusInsights.accounts,
      description: 'Measures activity for Accounts projects. Red indicates no updates in >20 days.'
    },
    { 
      title: 'Executive', 
      data: stats.statusInsights.executive,
      description: 'Shows executive follow-up status. Red indicates missed follow-ups. Projects without a follow-up date are excluded.'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-screen mesh-bg relative">
        <div className="glass-canvas" />
        <Sidebar />
        <div className={`flex-1 flex items-center justify-center transition-all duration-500 ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen mesh-bg relative overflow-hidden">
      <div className="glass-canvas" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[10%] h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="absolute top-[24rem] left-[8%] h-80 w-80 rounded-full bg-fuchsia-200/25 blur-3xl" />
        <div className="absolute bottom-10 right-[18%] h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>
      <Sidebar />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
        <Navbar />

        <div className={`px-4 lg:px-12 py-6 lg:py-10 pb-28 space-y-6 lg:space-y-8 superadmin-page-enter ${isRefreshing ? 'superadmin-page-refresh' : ''}`}>
          {isProjectCreationBlocked && (
            <section className="relative overflow-hidden rounded-[2.25rem] border border-amber-200/80 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.34),transparent_25%),linear-gradient(135deg,rgba(69,10,10,0.98),rgba(146,64,14,0.95)_38%,rgba(217,119,6,0.92))] p-6 lg:p-7 text-white shadow-[0_30px_80px_-30px_rgba(180,83,9,0.8)]">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.12),transparent_45%,rgba(255,255,255,0.06))]" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] border border-white/20 bg-white/10 shadow-sm">
                    <AlertTriangle className="h-7 w-7 text-amber-100" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-100/90">{limitAudienceLabel}</p>
                    <h2 className="premium-heading mt-2 text-2xl lg:text-3xl font-bold text-white">
                      {creationLimitStatus?.title || 'Project creation is temporarily paused'}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm lg:text-base leading-7 text-amber-50/95">
                      {creationLimitStatus?.message || 'New project creation is currently unavailable.'}
                    </p>
                  </div>
                </div>
                <div className="self-start rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-amber-50">
                  Attention Required
                </div>
              </div>
            </section>
          )}

          <section className="premium-surface rounded-[2.25rem] p-6 lg:p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.35),transparent_48%,rgba(15,23,42,0.08))]" />
            <div className="relative grid gap-6 xl:grid-cols-[1.4fr_0.85fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                  <span>{dateLabel}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{activeZone === 'ALL_ZONES' ? 'All Zones Lens' : activeZone}</span>
                </div>
                <div className="space-y-3">
                  <p className="premium-heading text-3xl lg:text-5xl font-bold text-slate-950">
                    {greeting}, {firstName}
                  </p>
                  <p className="max-w-2xl text-sm lg:text-base leading-7 text-slate-600">
                    A polished control room for invoice-led revenue, pipeline health, and execution tempo across your current zone context.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/60 bg-white/55 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                    Total projects: {stats.totalProjects}
                  </div>
                  <div className="rounded-full border border-white/60 bg-white/45 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                    Project value: {formatCompactCurrency(projectValueTotal)}
                  </div>
                  <div className="rounded-full border border-sky-200/70 bg-sky-50/60 px-4 py-2 text-xs font-semibold text-sky-800 shadow-sm">
                    Revenue shift: {trendShift >= 0 ? '+' : ''}{trendShift.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/60 bg-slate-950/[0.82] p-5 lg:p-6 text-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-sky-200/80">Live Signal</p>
                    <h2 className="premium-heading mt-2 text-2xl font-bold">Command Snapshot</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-sky-100">
                    Premium View
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.05] p-3 sm:p-4">
                    <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.22em] text-slate-400">Collected Revenue</p>
                    <p className="premium-heading mt-2 sm:mt-3 text-xl sm:text-3xl font-bold">{formatCompactCurrency(collectedRevenueTotal)}</p>
                    <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-slate-400">Project value {formatCompactCurrency(projectValueTotal)}</p>
                  </div>
                  <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/20 to-white/[0.04] p-3 sm:p-4">
                    <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.22em] text-slate-300">Conversion</p>
                    <p className="premium-heading mt-2 sm:mt-3 text-xl sm:text-3xl font-bold">{successRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.04] px-3 sm:px-4 py-2 sm:py-3">
                  <div>
                    <p className="text-[9px] sm:text-xs uppercase tracking-[0.22em] text-slate-400">Latest month</p>
                    <p className="mt-1 text-sm sm:text-lg font-semibold text-white">{latestTrend?.month || 'No trend yet'}</p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-semibold text-emerald-300">
                    <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{latestTrend ? `${latestTrend.projects} projects` : 'Waiting for data'}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {spotlightMetrics.map((metric, index) => (
              <div key={metric.label} className={`premium-surface rounded-2xl sm:rounded-[2rem] p-3 sm:p-5 lg:p-6 premium-line relative overflow-hidden ${index === 2 ? 'col-span-2 lg:col-span-1' : ''}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent}`} />
                <div className="relative flex items-start justify-between gap-2 sm:gap-4">
                  <div>
                    <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.28em] text-slate-500">{metric.label}</p>
                    <p className="premium-heading mt-2 sm:mt-3 text-xl sm:text-3xl lg:text-4xl font-bold text-slate-950">{metric.value}</p>
                    <p className="mt-1 sm:mt-3 text-[10px] sm:text-sm text-slate-600">{metric.detail}</p>
                  </div>
                  <div className="rounded-xl sm:rounded-[1.4rem] border border-white/60 bg-white/50 p-2 sm:p-3 shadow-sm">
                    <metric.icon className="h-4 w-4 sm:h-6 sm:w-6 text-slate-700" />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="premium-surface rounded-[2rem] p-6 lg:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Stage composition</p>
                  <h2 className="premium-heading mt-2 text-2xl font-bold text-slate-950">Flow Architecture</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold text-slate-600">
                  <span>Avg / project: {formatCompactCurrency(revenuePerProject)}</span>
                  <span className="rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] font-bold text-amber-800 shadow-sm">
                    Pending feedback: {pendingFeedbackProjects}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {stageEntries.length > 0 ? stageEntries.map(([stage, count]) => {
                  const share = stats.totalProjects > 0 ? (count / stats.totalProjects) * 100 : 0;
                  const width = stagePeak > 0 ? (count / stagePeak) * 100 : 0;
                  return (
                    <div key={stage} className="premium-line grid gap-2 pb-4 md:grid-cols-[180px_1fr_84px] md:items-center">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{formatStageName(stage)}</div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200/70">
                        <div className="h-full rounded-full bg-gradient-to-r from-slate-950 via-sky-700 to-cyan-500" style={{ width: `${width}%` }} />
                      </div>
                      <div className="text-right text-xs font-bold text-slate-800">{count} • {share.toFixed(1)}%</div>
                    </div>
                  );
                }) : <p className="text-xs text-slate-500">No stage distribution available.</p>}
                <div className="premium-line grid gap-2 pb-4 md:grid-cols-[180px_1fr_84px] md:items-center">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Pending Feedback</div>
                  <div className="h-3 overflow-hidden rounded-full bg-amber-100/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300"
                      style={{ width: `${Math.min(100, pendingFeedbackShare)}%` }}
                    />
                  </div>
                  <div className="text-right text-xs font-bold text-amber-800">
                    {pendingFeedbackProjects} - {pendingFeedbackShare.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="premium-surface rounded-[2rem] p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="rounded-[1.2rem] border border-white/60 bg-white/50 p-3">
                  <PieChart className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Live health</p>
                  <h2 className="premium-heading text-2xl font-bold text-slate-950">Status Streams</h2>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {statusStreams.map((stream) => {
                  const total = stream.data.red + stream.data.yellow + stream.data.green;
                  return (
                    <div key={stream.title} className="rounded-[1.6rem] border border-white/60 bg-white/45 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{stream.title}</p>
                          <div className="group relative flex items-center justify-center">
                            <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 translate-y-1 group-hover:translate-y-0">
                              <div className="bg-slate-800 text-white text-[11px] p-2.5 rounded-xl shadow-xl border border-slate-700 text-center leading-relaxed font-medium">
                                {stream.description}
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                            </div>
                          </div>
                        </div>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{total} signals</span>
                      </div>
                      <div className="mt-3 flex overflow-hidden rounded-full bg-slate-100">
                        <div className="h-2 bg-emerald-500" style={{ width: `${total ? (stream.data.green / total) * 100 : 0}%` }} />
                        <div className="h-2 bg-amber-400" style={{ width: `${total ? (stream.data.yellow / total) * 100 : 0}%` }} />
                        <div className="h-2 bg-rose-500" style={{ width: `${total ? (stream.data.red / total) * 100 : 0}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                        <div className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">Green {stream.data.green}</div>
                        <div className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">Yellow {stream.data.yellow}</div>
                        <div className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">Red {stream.data.red}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="premium-surface rounded-[2rem] p-6 lg:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Revenue tempo</p>
                  <h2 className="premium-heading mt-2 text-2xl font-bold text-slate-950">Invoice Monthly Bar Graph</h2>
                </div>
                <div className="text-sm font-semibold text-slate-600">
                  {trendShift >= 0 ? '+' : ''}{trendShift.toFixed(1)}% vs previous month
                </div>
              </div>
              <div className="mt-4 sm:mt-8">
                <div className="grid min-h-[14rem] grid-cols-2 gap-2 rounded-2xl border border-white/60 bg-white/45 p-2 sm:min-h-[18rem] sm:grid-cols-3 sm:gap-3 sm:rounded-[1.8rem] sm:p-4 lg:grid-cols-6">
                  {trendSeries.length > 0 ? trendSeries.map((month, index) => {
                    const height = trendPeak > 0 ? Math.max((month.revenue / trendPeak) * 100, month.revenue > 0 ? 12 : 4) : 8;
                    const isLatest = index === trendSeries.length - 1;
                    return (
                      <div key={`${month.month}-${index}`} className="flex min-w-0 flex-col gap-1 sm:gap-3">
                        <div className="text-center text-[8px] sm:text-[11px] font-bold text-slate-500">{formatCompactCurrency(month.revenue)}</div>
                        <div className="flex h-32 sm:h-44 items-end rounded-xl sm:rounded-[1.4rem] bg-slate-100/80 px-1.5 sm:px-3 py-1.5 sm:py-3">
                          <div
                            className={`w-full rounded-t-[0.5rem] sm:rounded-t-[1rem] shadow-[0_12px_24px_-16px_rgba(15,23,42,0.7)] ${isLatest ? 'bg-gradient-to-t from-slate-950 via-sky-700 to-cyan-400' : 'bg-gradient-to-t from-slate-400 via-slate-200 to-white'}`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="text-center">
                          <p className="truncate text-[9px] sm:text-xs font-bold text-slate-700">{month.month}</p>
                          <p className="text-[8px] sm:text-[11px] text-slate-500 hidden sm:block">{month.projects} projects</p>
                          <p className="text-[8px] sm:text-[11px] text-slate-500 sm:hidden">{month.projects}</p>
                        </div>
                      </div>
                    );
                  }) : <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No monthly trend available.</div>}
                </div>
              </div>
            </div>

            <div className="premium-surface rounded-[2rem] p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="rounded-[1.2rem] border border-white/60 bg-white/50 p-3">
                  <BarChart3 className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Procurement lens</p>
                  <h2 className="premium-heading text-2xl font-bold text-slate-950">Factory Pulse</h2>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-4">
                <div className="rounded-2xl sm:rounded-[1.6rem] border border-white/60 bg-white/50 p-3 sm:p-4">
                  <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-500">This month</p>
                  <p className="premium-heading mt-2 sm:mt-3 text-xl sm:text-3xl font-bold text-slate-950">{stats.productionSummary.currentMonthQuantity}</p>
                </div>
                <div className="rounded-2xl sm:rounded-[1.6rem] border border-white/60 bg-white/45 p-3 sm:p-4">
                  <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-500">Year to date</p>
                  <p className="premium-heading mt-2 sm:mt-3 text-xl sm:text-3xl font-bold text-slate-950">{stats.productionSummary.yearToDateQuantity}</p>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 rounded-2xl sm:rounded-[1.6rem] border border-white/60 bg-slate-950/[0.86] px-4 sm:px-5 py-3 sm:py-4 text-white">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <span className="text-[10px] sm:text-xs uppercase tracking-[0.24em] text-slate-300">Monthly procurement trend</span>
                  <span className={`text-sm sm:text-base font-bold ${stats.productionSummary.monthlyProductionTrend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {stats.productionSummary.monthlyProductionTrend >= 0 ? '+' : ''}{stats.productionSummary.monthlyProductionTrend.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Top products</p>
                  <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                    {stats.productionSummary.topProductsThisMonth.length > 0 ? stats.productionSummary.topProductsThisMonth.slice(0, 4).map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-2xl sm:rounded-[1.3rem] border border-white/60 bg-white/45 px-3 sm:px-4 py-2 sm:py-3">
                        <span className="text-xs sm:text-sm font-semibold text-slate-800">{item.name}</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-950">{item.quantity}</span>
                      </div>
                    )) : <p className="mt-3 text-xs sm:text-sm text-slate-500">No product movement yet.</p>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Recent Activity</p>
                  <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                    {stats.productionSummary.recentEntries.length > 0 ? stats.productionSummary.recentEntries.slice(0, 4).map((entry, index) => (
                      <div key={`${entry.productName}-${index}`} className="rounded-2xl sm:rounded-[1.3rem] border border-white/60 bg-white/50 px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate pr-2">{entry.productName}</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-950">+{entry.quantity}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                          <span>{entry.category}</span>
                          <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-GB') : 'N/A'}</span>
                        </div>
                      </div>
                    )) : <p className="mt-3 text-xs sm:text-sm text-slate-500">No recent procurement activity.</p>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="premium-surface rounded-[2rem] p-6 lg:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Quick readout</p>
                <h2 className="premium-heading mt-2 text-2xl font-bold text-slate-950">Executive Summary</h2>
              </div>
              <div className="text-sm font-semibold text-slate-600">
                {analytics?.completedThisMonth || 0} completed this month
              </div>
            </div>
            <div className="mt-4 sm:mt-6 grid grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-4">
              <SummaryStrip label="Total Projects" value={`${stats.totalProjects}`} icon={Briefcase} />
              <SummaryStrip label="Completed Projects" value={`${stats.completedProjects}`} icon={CheckCircle2} />
              <SummaryStrip
                label="Pending Revenue"
                value={formatCompactCurrency(pendingRevenueTotal)}
                detail={`${pendingFinanceProjectCount} backlog projects`}
                icon={Clock3}
              />
              <SummaryStrip label="Current Month Invoice" value={formatCompactCurrency(primaryCurrentMonthRevenue)} icon={IndianRupee} />
              <div className="col-span-2 xl:col-span-1">
                <SummaryStrip label="Project Value" value={formatCompactCurrency(projectValueTotal)} icon={IndianRupee} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const SummaryStrip = ({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/60 bg-white/45 px-3 sm:px-5 py-2 sm:py-4">
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      <div>
        <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <p className="premium-heading mt-2 sm:mt-3 text-lg sm:text-2xl font-bold text-slate-950">{value}</p>
        {detail && <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-500">{detail}</p>}
      </div>
      <div className="rounded-xl sm:rounded-[1.1rem] border border-white/60 bg-white/60 p-2 sm:p-3">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
      </div>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="w-full max-w-6xl space-y-6 px-4 lg:px-8">
    <div className="premium-surface rounded-[2.25rem] p-6 lg:p-8 animate-pulse">
      <div className="h-3 w-40 rounded-full bg-white/60" />
      <div className="mt-5 h-12 w-2/3 rounded-2xl bg-white/60" />
      <div className="mt-4 h-5 w-1/2 rounded-xl bg-white/50" />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
        <div className="h-24 rounded-[1.6rem] bg-white/50" />
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="premium-surface h-40 rounded-[2rem] animate-pulse" />
      <div className="premium-surface h-40 rounded-[2rem] animate-pulse" />
      <div className="premium-surface h-40 rounded-[2rem] animate-pulse" />
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="premium-surface h-80 rounded-[2rem] animate-pulse" />
      <div className="premium-surface h-80 rounded-[2rem] animate-pulse" />
    </div>
  </div>
);
