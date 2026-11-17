import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useToast } from '../context/ToastContext';
import { FeedbackProject, Zone } from '../types';
import { projectApi } from '../services/api';
import { CheckCircle2, MessageSquareQuote, Phone, ShieldCheck, User2, XCircle } from 'lucide-react';

const PAGE_SIZE = 10;
type FeedbackTab = 'pending' | 'no';

const formatZoneLabel = (zone?: string) => zone ? zone.replace(/_/g, ' ') : 'All Zones';
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded';

const zoneOptions: Array<{ label: string; value: '' | Zone }> = [
    { label: 'All Zones', value: '' },
    { label: 'Zone 1', value: 'ZONE_1' },
    { label: 'Zone 2', value: 'ZONE_2' },
    { label: 'Zone 3', value: 'ZONE_3' }
];

export const FeedbackPage: React.FC = () => {
    const { showToast } = useToast();
    const { isSidebarCollapsed, showSidebar } = useLayout();
    const [activeTab, setActiveTab] = useState<FeedbackTab>('pending');
    const [tabProjects, setTabProjects] = useState<Record<FeedbackTab, FeedbackProject[]>>({
        pending: [],
        no: []
    });
    const [tabLoading, setTabLoading] = useState<Record<FeedbackTab, boolean>>({
        pending: true,
        no: false
    });
    const [tabPage, setTabPage] = useState<Record<FeedbackTab, number>>({
        pending: 1,
        no: 1
    });
    const [tabTotalPages, setTabTotalPages] = useState<Record<FeedbackTab, number>>({
        pending: 1,
        no: 1
    });
    const [tabTotalElements, setTabTotalElements] = useState<Record<FeedbackTab, number>>({
        pending: 0,
        no: 0
    });
    const [zoneFilter, setZoneFilter] = useState<'' | Zone>('');
    const [submittingId, setSubmittingId] = useState<number | null>(null);
    const requestIdRef = useRef<Record<FeedbackTab, number>>({ pending: 0, no: 0 });
    const currentPage = tabPage[activeTab];
    const currentTotalPages = tabTotalPages[activeTab];
    const currentTotalElements = tabTotalElements[activeTab];
    const currentProjects = tabProjects[activeTab];
    const currentLoading = tabLoading[activeTab];
    const activeQueueRef = useRef({ tab: activeTab, page: currentPage, zone: zoneFilter });
    activeQueueRef.current = { tab: activeTab, page: currentPage, zone: zoneFilter };

    const loadQueue = useCallback(async (tab: FeedbackTab, targetPage: number, targetZone: '' | Zone) => {
        const requestId = ++requestIdRef.current[tab];
        setTabLoading((prev) => ({ ...prev, [tab]: true }));
        try {
            const result = await projectApi.getFeedbackQueue(
                targetPage,
                PAGE_SIZE,
                targetZone || undefined,
                tab === 'pending' ? 'PENDING' : 'NO'
            );
            if (requestId !== requestIdRef.current[tab]) return;
            setTabProjects((prev) => ({ ...prev, [tab]: result.content || [] }));
            const nextTotalPages = Math.max(result.totalPages || 0, 1);
            setTabTotalPages((prev) => {
                return prev[tab] === nextTotalPages ? prev : { ...prev, [tab]: nextTotalPages };
            });
            setTabTotalElements((prev) => {
                const nextTotalElements = result.totalElements || 0;
                return prev[tab] === nextTotalElements ? prev : { ...prev, [tab]: nextTotalElements };
            });
            setTabPage((prev) => {
                const nextPage = Math.min((result.number ?? 0) + 1, nextTotalPages);
                return prev[tab] === nextPage ? prev : { ...prev, [tab]: nextPage };
            });
        } catch (error: any) {
            if (requestId !== requestIdRef.current[tab]) return;
            showToast(error?.message || `Failed to load ${tab === 'pending' ? 'feedback queue' : 'no-feedback list'}`, 'error');
        } finally {
            if (requestId === requestIdRef.current[tab]) {
                setTabLoading((prev) => ({ ...prev, [tab]: false }));
            }
        }
    }, [showToast]);

    useEffect(() => {
        void loadQueue(activeTab, currentPage, zoneFilter);
    }, [activeTab, currentPage, loadQueue, zoneFilter]);

    const handleZoneChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextZone = event.target.value as '' | Zone;
        setZoneFilter(nextZone);
        setTabPage({ pending: 1, no: 1 });
    };

    const handleMarkFeedback = async (projectId: number, feedbackCollected: boolean) => {
        const sourceTab = activeTab;
        setSubmittingId(projectId);
        try {
            await projectApi.updateProjectFeedback(projectId, feedbackCollected);
            showToast(`Feedback marked ${feedbackCollected ? 'Yes' : 'No'}`, 'success');

            setTabProjects((prev) => ({
                ...prev,
                [sourceTab]: prev[sourceTab].filter((project) => project.id !== projectId)
            }));
            setTabTotalElements((prev) => ({ ...prev, [sourceTab]: Math.max(prev[sourceTab] - 1, 0) }));

            // Refresh only the queue the user is currently viewing. This avoids an
            // update started in one zone/tab replacing results in a newer selection.
            const activeQueue = activeQueueRef.current;
            await loadQueue(activeQueue.tab, activeQueue.page, activeQueue.zone);
        } catch (error: any) {
            showToast(error?.message || 'Failed to update feedback', 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const queueSummary = useMemo(() => {
        if (activeTab === 'pending') {
            if (currentTotalElements === 0) return 'No completed projects are waiting for feedback.';
            if (currentTotalElements === 1) return '1 completed project is waiting for feedback capture.';
            return `${currentTotalElements} completed projects are waiting for feedback capture.`;
        }
        if (currentTotalElements === 0) return 'No projects are currently marked as feedback not taken.';
        if (currentTotalElements === 1) return '1 project is currently marked as feedback not taken.';
        return `${currentTotalElements} projects are currently marked as feedback not taken.`;
    }, [activeTab, currentTotalElements]);

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />

                <main className="px-4 lg:px-12 py-6 lg:py-10 pb-32">
                <div className="max-w-7xl mx-auto space-y-6">
                    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_34%)] pointer-events-none" />
                        <div className="relative px-6 py-7 sm:px-8 lg:px-10 lg:py-9">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-3xl">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
                                        <MessageSquareQuote size={14} />
                                        Feedback Workspace
                                    </div>
                                    <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
                                        Manage pending feedback and revisit projects marked no.
                                    </h1>
                                    <p className="mt-3 text-sm sm:text-base text-slate-600 leading-7">
                                        Review all completed projects that still need feedback, and keep a dedicated follow-up queue for projects where feedback was not collected the first time.
                                    </p>
                                </div>

                                <div className="w-full xl:max-w-sm rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-5 text-white shadow-2xl">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-200">
                                                {activeTab === 'pending' ? 'Pending Queue' : 'No Feedback Queue'}
                                            </p>
                                            <p className="mt-2 text-2xl font-black">{currentTotalElements}</p>
                                            <p className="mt-1 text-sm text-slate-300">{queueSummary}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Viewing</div>
                                            <div className="mt-1 text-sm font-bold text-white">{formatZoneLabel(zoneFilter || undefined)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-slate-200/80 bg-white/70 p-4">
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('pending')}
                                        className={`rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                                            activeTab === 'pending'
                                                ? 'bg-sky-600 text-white shadow-lg'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        Pending Feedback
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('no')}
                                        className={`rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                                            activeTab === 'no'
                                                ? 'bg-rose-600 text-white shadow-lg'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        Marked No
                                    </button>
                                </div>

                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Filter by Zone</p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {activeTab === 'pending'
                                                ? 'Pending feedback projects across all zones.'
                                                : 'Projects previously marked as feedback not taken, across all zones.'}
                                        </p>
                                    </div>
                                    <select
                                        value={zoneFilter}
                                        onChange={handleZoneChange}
                                        className="h-12 w-full lg:w-auto lg:min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                    >
                                        {zoneOptions.map((option) => (
                                            <option key={option.label} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        {currentLoading ? (
                            <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-8 text-center text-slate-600 shadow-[0_25px_70px_-42px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                                Loading {activeTab === 'pending' ? 'feedback queue' : 'no-feedback queue'}...
                            </div>
                        ) : currentProjects.length === 0 ? (
                            <div className="rounded-[1.75rem] border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/70 to-sky-50/80 p-10 text-center shadow-[0_25px_70px_-42px_rgba(16,185,129,0.28)]">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 size={28} />
                                </div>
                                <h2 className="mt-5 text-2xl font-black text-slate-950">
                                    {activeTab === 'pending' ? 'Feedback queue is clear.' : 'No-feedback queue is clear.'}
                                </h2>
                                <p className="mt-3 text-sm sm:text-base text-slate-600">
                                    {activeTab === 'pending'
                                        ? 'There are no completed projects waiting for a feedback decision in this filter right now.'
                                        : 'There are no projects currently marked as feedback not taken in this filter right now.'}
                                </p>
                            </div>
                        ) : (
                            currentProjects.map((project) => (
                                <article
                                    key={project.id}
                                    className="rounded-[1.75rem] border border-white/75 bg-white/80 p-5 sm:p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_30px_80px_-44px_rgba(15,23,42,0.38)]"
                                >
                                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
                                                    activeTab === 'pending'
                                                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                                                        : 'border-rose-200 bg-rose-50 text-rose-700'
                                                }`}>
                                                    {activeTab === 'pending' ? 'Pending Feedback' : 'Marked No'}
                                                </span>
                                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
                                                    {formatZoneLabel(project.zone)}
                                                </span>
                                            </div>
                                            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 break-words">
                                                {project.projectName || project.school}
                                            </h2>
                                            <p className="mt-1 text-sm text-slate-500 break-words">{project.school}</p>

                                            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                        <User2 size={14} className="text-sky-600" />
                                                        Executive
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold text-slate-900 break-words">{project.createdBy || 'Not recorded'}</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                        <ShieldCheck size={14} className="text-sky-600" />
                                                        Zone
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold text-slate-900">{formatZoneLabel(project.zone)}</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                        <User2 size={14} className="text-sky-600" />
                                                        Contact Person
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold text-slate-900 break-words">{project.contactPerson || 'Not recorded'}</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                        <Phone size={14} className="text-sky-600" />
                                                        Contact Number
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold text-slate-900 break-words">{project.contactNumber || 'Not recorded'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-full xl:w-[280px] xl:min-w-[280px] rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-2xl">
                                            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">Review Actions</div>
                                            <p className="mt-2 text-sm text-slate-200">
                                                {activeTab === 'pending'
                                                    ? 'Mark whether feedback has been collected for this completed project.'
                                                    : 'This project was previously marked no. You can now confirm feedback as yes once it is collected.'}
                                            </p>
                                            <div className="mt-4 space-y-2 text-xs text-slate-300">
                                                <div>Completed: <span className="font-bold text-white">{formatDate(project.completionDate)}</span></div>
                                                <div>Last updated: <span className="font-bold text-white">{formatDate(project.lastUpdatedAt)}</span></div>
                                            </div>
                                            <div className={`mt-5 grid gap-3 ${activeTab === 'pending' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-1' : 'grid-cols-1'}`}>
                                                <button
                                                    type="button"
                                                    disabled={submittingId === project.id}
                                                    onClick={() => handleMarkFeedback(project.id, true)}
                                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <CheckCircle2 size={16} />
                                                    Yes
                                                </button>
                                                {activeTab === 'pending' && (
                                                    <button
                                                        type="button"
                                                        disabled={submittingId === project.id}
                                                        onClick={() => handleMarkFeedback(project.id, false)}
                                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <XCircle size={16} />
                                                        No
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </section>

                    {currentTotalPages > 1 && (
                        <div className="flex flex-col items-center justify-between gap-3 rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:flex-row">
                            <p className="text-sm font-semibold text-slate-600">
                                Page {currentPage} of {currentTotalPages}
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    disabled={currentPage <= 1 || currentLoading}
                                    onClick={() => setTabPage((prev) => ({ ...prev, [activeTab]: Math.max(prev[activeTab] - 1, 1) }))}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    disabled={currentPage >= currentTotalPages || currentLoading}
                                    onClick={() => setTabPage((prev) => ({ ...prev, [activeTab]: Math.min(prev[activeTab] + 1, currentTotalPages) }))}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </main>
            </div>
        </div>
    );
};
