import { escapeCsvCell } from '../utils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ClipboardCheck, Download, FolderPlus, RefreshCw } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useToast } from '../context/ToastContext';
import { useZone } from '../context/ZoneContext';
import { reportsApi, usersApi } from '../services/api';
import { ExecutiveActivityReport, ExecutiveActivityRow, User } from '../types';

const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDate = (value?: string) => {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '—';
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
};

const escapeCsv = escapeCsvCell;

const downloadCsv = (from: string, to: string, report: ExecutiveActivityReport) => {
    const rows = [
        ...report.schoolVisits.map((row) => ['School Visit', row.activityDate, row.executiveName, row.school, row.projectWork || '']),
        ...report.projectsCreated.map((row) => ['Project Created', row.activityDate, row.executiveName, row.school, row.projectWork || ''])
    ];
    const csv = [
        ['Activity', 'Date', 'Executive', 'School', 'Project Work'].map(escapeCsv).join(','),
        ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `executive-activity-${from}-to-${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

interface ActivityTableProps {
    rows: ExecutiveActivityRow[];
    emptyMessage: string;
}

const ActivityTable: React.FC<ActivityTableProps> = ({ rows, emptyMessage }) => {
    if (rows.length === 0) {
        return <p className="px-5 py-9 text-center text-sm font-semibold text-slate-500">{emptyMessage}</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left">
                <thead className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Executive</th>
                        <th className="px-5 py-3">School</th>
                        <th className="px-5 py-3">Project Work</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map((row, index) => (
                        <tr key={`${row.projectId}-${row.activityDate}-${index}`} className="bg-white transition-colors hover:bg-slate-50/70">
                            <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-700">{formatDate(row.activityDate)}</td>
                            <td className="px-5 py-4 text-sm font-bold text-slate-900">{row.executiveName || '—'}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-700">{row.school || '—'}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-700">{row.projectWork || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const ExecutiveActivityReportPage: React.FC = () => {
    const navigate = useNavigate();
    const { showSidebar, isSidebarCollapsed } = useLayout();
    const { effectiveZone } = useZone();
    const { showToast } = useToast();
    const today = useMemo(() => toLocalDateKey(new Date()), []);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [report, setReport] = useState<ExecutiveActivityReport | null>(null);
    const [executives, setExecutives] = useState<User[]>([]);
    const [selectedExecutiveId, setSelectedExecutiveId] = useState<number | undefined>();
    const [executivesLoading, setExecutivesLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);

    const hasValidRange = Boolean(fromDate && toDate && fromDate <= toDate);
    const loadReport = useCallback(async () => {
        if (!hasValidRange) return;
        setLoading(true);
        try {
            setReport(await reportsApi.getExecutiveActivity(fromDate, toDate, effectiveZone, selectedExecutiveId));
        } catch (error: any) {
            setReport(null);
            showToast(error?.message || 'Unable to load the executive activity report.', 'error');
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    }, [effectiveZone, fromDate, hasValidRange, selectedExecutiveId, showToast, toDate]);

    useEffect(() => {
        void loadReport();
    }, [loadReport]);

    useEffect(() => {
        let cancelled = false;
        const loadExecutives = async () => {
            setExecutivesLoading(true);
            try {
                // Deliberately omit the report zone: this selector must include every
                // executive, while a selected executive's report is server-scoped by ID.
                const directory = await usersApi.getDirectory(undefined, ['ROLE_EXECUTIVE']);
                if (!cancelled) {
                    setExecutives(directory
                        .filter((user) => user.role === 'ROLE_EXECUTIVE' && user.id != null)
                        .sort((left, right) => (left.name || '').localeCompare(right.name || '')));
                }
            } catch (error: any) {
                if (!cancelled) {
                    setExecutives([]);
                    showToast(error?.message || 'Unable to load executives.', 'error');
                }
            } finally {
                if (!cancelled) setExecutivesLoading(false);
            }
        };
        void loadExecutives();
        return () => { cancelled = true; };
    }, [showToast]);

    const setTodayRange = () => {
        setFromDate(today);
        setToDate(today);
    };
    const setLastSevenDays = () => {
        const start = new Date();
        start.setDate(start.getDate() - 6);
        setFromDate(toLocalDateKey(start));
        setToDate(today);
    };
    const totalActivities = (report?.schoolVisits.length || 0) + (report?.projectsCreated.length || 0);

    return (
        <div className="relative flex min-h-screen mesh-bg">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex min-w-0 flex-1 flex-col transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />
                <main className="px-4 py-6 pb-24 lg:px-12 lg:py-10">
                    <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-indigo-700">
                                <ArrowLeft size={16} /> Back to workspace
                            </button>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Executive workspace</p>
                            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">Today&apos;s Report</h1>
                            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-600">Review executive school visits and newly created projects for any selected calendar date range.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => report && downloadCsv(fromDate, toDate, report)}
                            disabled={!report || loading || totalActivities === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download size={18} /> Export CSV
                        </button>
                    </div>

                    <section className="mb-7 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-premium backdrop-blur sm:p-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">From date</span>
                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
                                        <CalendarDays size={17} className="text-indigo-600" />
                                        <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm font-bold text-slate-800 shadow-none outline-none focus:border-0 focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70" />
                                    </div>
                                </label>
                                <label className="block">
                                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">To date</span>
                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
                                        <CalendarDays size={17} className="text-indigo-600" />
                                        <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm font-bold text-slate-800 shadow-none outline-none focus:border-0 focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70" />
                                    </div>
                                </label>
                                <label className="block sm:col-span-2 xl:col-span-1">
                                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Executive (all zones)</span>
                                    <select
                                        value={selectedExecutiveId?.toString() || ''}
                                        onChange={(event) => setSelectedExecutiveId(event.target.value ? Number(event.target.value) : undefined)}
                                        disabled={executivesLoading}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <option value="">All executives</option>
                                        {executives.map((executive) => (
                                            <option key={executive.id} value={executive.id}>
                                                {executive.name} {executive.zone ? `(${executive.zone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={setTodayRange} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">Today</button>
                                <button type="button" onClick={setLastSevenDays} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">Last 7 days</button>
                                <button type="button" onClick={() => void loadReport()} disabled={!hasValidRange || loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                                </button>
                            </div>
                        </div>
                        {!hasValidRange && <p className="mt-4 text-sm font-bold text-rose-600">Choose an end date that is on or after the start date.</p>}
                    </section>

                    <section className="mb-7 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-600">Total activity</p>
                            <p className="mt-2 text-3xl font-black text-indigo-950">{loading ? '—' : totalActivities}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Schools visited</p>
                            <p className="mt-2 text-3xl font-black text-emerald-950">{loading ? '—' : report?.schoolVisits.length || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Projects created</p>
                            <p className="mt-2 text-3xl font-black text-violet-950">{loading ? '—' : report?.projectsCreated.length || 0}</p>
                        </div>
                    </section>

                    <div className="space-y-7">
                        <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-premium">
                            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ClipboardCheck size={20} /></span>
                                <div>
                                    <h2 className="font-black text-slate-900">Executives who visited schools</h2>
                                    <p className="mt-0.5 text-sm font-medium text-slate-500">Completed school visits in the selected dates.</p>
                                </div>
                            </div>
                            {loading ? <p className="px-5 py-9 text-center text-sm font-semibold text-slate-500">Loading school visits…</p> : <ActivityTable rows={report?.schoolVisits || []} emptyMessage={hasLoaded ? 'No completed school visits were recorded for these dates.' : 'Loading…'} />}
                        </section>

                        <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-premium">
                            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FolderPlus size={20} /></span>
                                <div>
                                    <h2 className="font-black text-slate-900">Executives who created projects</h2>
                                    <p className="mt-0.5 text-sm font-medium text-slate-500">Projects created in the selected dates.</p>
                                </div>
                            </div>
                            {loading ? <p className="px-5 py-9 text-center text-sm font-semibold text-slate-500">Loading projects…</p> : <ActivityTable rows={report?.projectsCreated || []} emptyMessage={hasLoaded ? 'No projects were created by executives for these dates.' : 'Loading…'} />}
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
};
