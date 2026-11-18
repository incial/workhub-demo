import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { Tabs } from '../components/ui/Tabs';
import { Project, UpdateInstallationDataRequest, InstallationStatus, ProjectClassification } from '../types';
import { projectApi, usersApi } from '../services/api';
import { Search, Wrench, CheckCircle, XCircle, Clock, Building2, MapPin, Calendar, AlertCircle, Edit2, Eye, User, Phone, FileText, Info } from 'lucide-react';
import { ProjectDeletionRequestModal } from '../components/ui/ProjectDeletionRequestModal';
import { StandardModuleModal } from '../components/ui/StandardModuleModal';
import { EmbeddedUserDashboard } from '../components/dashboard/EmbeddedUserDashboard';

const formatZoneLabel = (zone?: string) => {
    if (!zone) return 'N/A';
    return zone.replace(/_/g, ' ');
};

const ExecutiveInfoHover: React.FC<{ createdBy?: string; zone?: string }> = ({ createdBy, zone }) => {
    if (!createdBy && !zone) return null;
    return (
        <div className="inline-flex items-center gap-3">
            <span className="text-slate-300 font-light">|</span>
            <div className="flex flex-wrap items-center gap-2">
                {createdBy && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-50/50 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                        <User size={12} className="text-blue-500" />
                        {createdBy}
                    </span>
                )}
                {zone && (
                    <span className="inline-flex items-center rounded-full border border-slate-200/60 bg-slate-50/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm">
                        {formatZoneLabel(zone)}
                    </span>
                )}
            </div>
        </div>
    );
};

const parseInstallationItems = (installationTaskList?: string): string[] => {
    return (installationTaskList || '')
        .split(/[\n,，،]+/)
        .map(item => item.trim())
        .filter(Boolean);
};

export const InstallationPage: React.FC = () => {
    const classificationOptions: Array<ProjectClassification | 'ALL'> = ['ALL', 'I1', 'I2', 'I3'];
    const { user, isDemo } = useAuth();
    const { showToast } = useToast();
    const { isSidebarCollapsed, showSidebar } = useLayout();
    const [tabProjects, setTabProjects] = useState<Record<'upcoming' | 'active' | 'done', Project[]>>({
        upcoming: [],
        active: [],
        done: []
    });
    const [tabLoading, setTabLoading] = useState<Record<'upcoming' | 'active' | 'done', boolean>>({
        upcoming: false,
        active: false,
        done: false
    });
    const [tabLoaded, setTabLoaded] = useState<Record<'upcoming' | 'active' | 'done', boolean>>({
        upcoming: false,
        active: false,
        done: false
    });
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [projectForDeletion, setProjectForDeletion] = useState<Project | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [completedSearch, setCompletedSearch] = useState('');
    const [classificationFilter, setClassificationFilter] = useState<ProjectClassification | 'ALL'>('ALL');
    const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'done'>('upcoming');
    const [tabCounts, setTabCounts] = useState<Record<'upcoming' | 'active', number>>({
        upcoming: 0,
        active: 0
    });
    const [doneCount, setDoneCount] = useState(0);
    const [donePage, setDonePage] = useState(1);
    const [doneTotalPages, setDoneTotalPages] = useState(1);
    const [executiveNamesByEmail, setExecutiveNamesByEmail] = useState<Record<string, string>>({});
    const completedSearchRef = useRef('');
    const didInitRef = useRef(false);
    const tabLoadingRef = useRef<Record<'upcoming' | 'active' | 'done', boolean>>({
        upcoming: false,
        active: false,
        done: false
    });
    const tabLoadedRef = useRef<Record<'upcoming' | 'active' | 'done', boolean>>({
        upcoming: false,
        active: false,
        done: false
    });
    const tabFailedRef = useRef<Record<'upcoming' | 'active' | 'done', boolean>>({
        upcoming: false,
        active: false,
        done: false
    });
    const loading = tabLoading[activeTab];
    const donePageSize = 10;
    const useAdminBadgeCounts = isDemo || user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_SUPER_ADMIN' || user?.role === 'ROLE_OPERATOR';

    const loadProjects = React.useCallback(async (tab: 'upcoming' | 'active' | 'done', force = false, targetPage = 1, targetSearch = completedSearchRef.current) => {
        if (tabLoadingRef.current[tab] || ((tabLoadedRef.current[tab] || tabFailedRef.current[tab]) && !force)) return;
        const bucketByTab: Record<'upcoming' | 'active' | 'done', 'UPCOMING' | 'ACTIVE' | 'DONE'> = {
            upcoming: 'UPCOMING',
            active: 'ACTIVE',
            done: 'DONE'
        };
        try {
            if (force) {
                tabFailedRef.current = { ...tabFailedRef.current, [tab]: false };
            }
            tabLoadingRef.current = { ...tabLoadingRef.current, [tab]: true };
            setTabLoading((prev) => ({ ...prev, [tab]: true }));
            if (tab === 'done') {
                const pageData = await projectApi.getDashboardCompletedProjectsPaged('INSTALLATION', undefined, targetSearch, targetPage, donePageSize);
                const normalizedData = (pageData.content || []).filter((p) => p.currentStage !== 'DROPPED');
                setTabProjects((prev) => ({ ...prev, done: normalizedData }));
                setDoneCount(pageData.totalElements || 0);
                setDonePage((pageData.number ?? 0) + 1);
                setDoneTotalPages(Math.max(pageData.totalPages || 0, 1));
            } else {
                const data = await projectApi.getInstallationProjects(undefined, bucketByTab[tab]);
                const normalizedData = data.filter((p) => p.currentStage !== 'DROPPED');
                setTabProjects((prev) => ({ ...prev, [tab]: normalizedData }));
                setTabCounts((prev) => ({ ...prev, [tab]: normalizedData.length }));
            }
            tabFailedRef.current = { ...tabFailedRef.current, [tab]: false };
            tabLoadedRef.current = { ...tabLoadedRef.current, [tab]: true };
            setTabLoaded((prev) => ({ ...prev, [tab]: true }));
        } catch (error: any) {
            tabFailedRef.current = { ...tabFailedRef.current, [tab]: true };
            tabLoadedRef.current = { ...tabLoadedRef.current, [tab]: false };
            setTabLoaded((prev) => ({ ...prev, [tab]: false }));
            showToast(error.message || 'Failed to load projects', 'error');
        } finally {
            tabLoadingRef.current = { ...tabLoadingRef.current, [tab]: false };
            setTabLoading((prev) => ({ ...prev, [tab]: false }));
        }
    }, [donePageSize, showToast]);

    const loadBadgeCounts = React.useCallback(async () => {
        try {
            const counts = useAdminBadgeCounts
                ? await projectApi.getAdminDashboardBadgeCounts('INSTALLATION')
                : await projectApi.getDashboardBadgeCounts('INSTALLATION');
            setTabCounts((prev) => ({
                ...prev,
                upcoming: counts.onboardedCount || 0,
                active: counts.activeCount || 0
            }));
            setDoneCount(counts.completedCount || 0);
        } catch (error: any) {
            showToast(error.message || 'Failed to load installation counts', 'error');
        }
    }, [showToast, useAdminBadgeCounts]);

    useEffect(() => {
        completedSearchRef.current = completedSearch;
    }, [completedSearch]);

    useEffect(() => {
        const loadExecutiveDirectory = async () => {
            try {
                const executives = await usersApi.getDirectory(undefined, ['ROLE_EXECUTIVE']);
                setExecutiveNamesByEmail(
                    executives.reduce<Record<string, string>>((acc, executive) => {
                        const email = (executive.email || '').trim().toLowerCase();
                        if (email && executive.name) {
                            acc[email] = executive.name;
                        }
                        return acc;
                    }, {})
                );
            } catch {
                setExecutiveNamesByEmail({});
            }
        };
        loadExecutiveDirectory();
    }, []);

    const getExecutiveDisplayName = React.useCallback((createdBy?: string) => {
        if (!createdBy) return undefined;
        const normalized = createdBy.trim().toLowerCase();
        return executiveNamesByEmail[normalized] || createdBy;
    }, [executiveNamesByEmail]);

    useEffect(() => {
        if (didInitRef.current) {
            return;
        }
        didInitRef.current = true;
        setActiveTab('upcoming');
        setTabProjects({ upcoming: [], active: [], done: [] });
        setTabLoading({ upcoming: false, active: false, done: false });
        setTabLoaded({ upcoming: false, active: false, done: false });
        setSearchInput('');
        setCompletedSearch('');
        setClassificationFilter('ALL');
        setTabCounts({ upcoming: 0, active: 0 });
        setDoneCount(0);
        setDonePage(1);
        setDoneTotalPages(1);
        tabLoadingRef.current = { upcoming: false, active: false, done: false };
        tabLoadedRef.current = { upcoming: false, active: false, done: false };
        tabFailedRef.current = { upcoming: false, active: false, done: false };
        void loadBadgeCounts();
        void loadProjects('upcoming');
    }, []);

    const isCurrentTabLoaded = tabLoaded[activeTab];
    const isCurrentTabLoading = tabLoading[activeTab];
    const isCurrentTabFailed = tabFailedRef.current[activeTab];

    useEffect(() => {
        if (!isCurrentTabLoaded && !isCurrentTabLoading && !isCurrentTabFailed) {
            loadProjects(activeTab);
        }
    }, [activeTab, isCurrentTabFailed, isCurrentTabLoaded, isCurrentTabLoading, loadProjects]);

    const resolveInstallationTab = (project: Project): 'upcoming' | 'active' | 'done' | null => {
        if (project.currentStage === 'DROPPED') {
            return null;
        }
        if (project.installationStatus === 'WORK_DONE' || project.currentStage === 'COMPLETED') {
            return 'done';
        }
        if (project.currentStage === 'ACCOUNTS') {
            return 'upcoming';
        }
        if (project.currentStage === 'INSTALLATION') {
            return 'active';
        }
        return null;
    };

    const reconcileInstallationProject = (updated: Project) => {
        setTabProjects((prev) => {
            const withoutProject = {
                upcoming: prev.upcoming.filter((p) => p.id !== updated.id),
                active: prev.active.filter((p) => p.id !== updated.id),
                done: prev.done.filter((p) => p.id !== updated.id)
            };

            const targetTab = resolveInstallationTab(updated);
            if (!targetTab) {
                setTabCounts({
                    upcoming: withoutProject.upcoming.length,
                    active: withoutProject.active.length
                });
                setDoneCount(withoutProject.done.length);
                return withoutProject;
            }

            const nextProjects = {
                ...withoutProject,
                [targetTab]: [updated, ...withoutProject[targetTab]]
            };
            setTabCounts({
                upcoming: nextProjects.upcoming.length,
                active: nextProjects.active.length
            });
            setDoneCount(nextProjects.done.length);
            return nextProjects;
        });
    };

    const handleUpdateInstallation = async (projectId: number, formData: UpdateInstallationDataRequest) => {
        const scrollY = window.scrollY;
        try {
            const updated = await projectApi.updateInstallationData(projectId, formData);
            reconcileInstallationProject(updated);
            void loadBadgeCounts();
            if (tabLoaded.done) {
                void loadProjects('done', true, donePage, completedSearch);
            }
            showToast('Installation status updated successfully', 'success');
            setShowStatusModal(false);
            setSelectedProject(null);
            requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
        } catch (error: any) {
            showToast(error.message || 'Failed to update installation status', 'error');
        }
    };

    const handleViewDetails = async (project: Project) => {
        setSelectedProject(project);
        setShowDetailsModal(true);

        try {
            const latestProject = await projectApi.getProjectById(project.id);
            setSelectedProject(latestProject);
        } catch (error: any) {
            showToast(error.message || 'Failed to load latest project details', 'error');
        }
    };

    const handleDeletionRequest = (project: Project) => {
        setProjectForDeletion(project);
    };

    const submitDeletionRequest = async (reason: string) => {
        if (!projectForDeletion) return;
        try {
            await projectApi.requestProjectDeletion(projectForDeletion.id, { reason });
            showToast('Deletion request submitted. Project is now frozen.', 'success');
            setProjectForDeletion(null);
            loadProjects('upcoming', true);
            if (tabLoaded.active) {
                loadProjects('active', true);
            }
            if (tabLoaded.done) {
                loadProjects('done', true, donePage, completedSearch);
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to submit deletion request', 'error');
        }
    };

    const handleCompletedSearch = () => {
        if (activeTab !== 'done') return;
        const normalizedSearch = searchInput.trim();
        setCompletedSearch(normalizedSearch);
        setDonePage(1);
        void loadProjects('done', true, 1, normalizedSearch);
    };

    // Filter projects based on active tab and search
    const filteredProjects = React.useMemo(() => {
        if (activeTab === 'done') {
            const lowerSearchTerm = completedSearch.toLowerCase();
            if (!lowerSearchTerm) {
                return tabProjects.done;
            }
            return tabProjects.done.filter((p) =>
                (p.projectName || p.school).toLowerCase().includes(lowerSearchTerm) ||
                p.school.toLowerCase().includes(lowerSearchTerm) ||
                p.contactPerson?.toLowerCase().includes(lowerSearchTerm)
            );
        }
        const lowerSearchTerm = searchInput.toLowerCase();
        const tabFiltered = tabProjects[activeTab];

        return tabFiltered.filter((p) => {
            const matchesSearch =
            p.school.toLowerCase().includes(lowerSearchTerm) ||
            p.contactPerson?.toLowerCase().includes(lowerSearchTerm) ||
            p.contactNumber?.includes(searchInput);
            const matchesClassification =
                classificationFilter === 'ALL' || p.projectClassification === classificationFilter;
            return matchesSearch && matchesClassification;
        });
    }, [tabProjects, searchInput, activeTab, completedSearch, classificationFilter]);

    const tabs = [
        { 
            id: 'upcoming', 
            label: 'Upcoming',
            count: tabCounts.upcoming
        },
        { 
            id: 'active', 
            label: 'Active',
            count: tabCounts.active
        },
        { 
            id: 'done', 
            label: 'Done',
            count: doneCount
        }
    ];

    const getInstallationStatusColor = (status?: InstallationStatus) => {
        switch (status) {
            case 'WORK_DONE':
                return 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg';
            case 'NOT_DONE':
                return 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg';
            case 'PENDING':
            default:
                return 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg';
        }
    };

    const getInstallationStatusIcon = (status?: InstallationStatus) => {
        switch (status) {
            case 'WORK_DONE':
                return <CheckCircle size={24} className="shrink-0" />;
            case 'NOT_DONE':
                return <XCircle size={24} className="shrink-0" />;
            case 'PENDING':
            default:
                return <Clock size={24} className="shrink-0" />;
        }
    };

    const getStageGradient = () => {
        return 'bg-gradient-to-r from-blue-500 to-indigo-600';
    };

    const getCardStatusBadge = (tab: 'upcoming' | 'active' | 'done') => {
        if (tab === 'active') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (tab === 'done') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getInstallationStatusMeta = (status?: InstallationStatus) => {
        switch (status) {
            case 'WORK_DONE':
                return {
                    label: 'Work Done',
                    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                };
            case 'NOT_DONE':
                return {
                    label: 'Not Done',
                    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200'
                };
            case 'PENDING':
            default:
                return {
                    label: 'Pending',
                    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200'
                };
        }
    };

    const getInstallationItems = (project: Project) => parseInstallationItems(project.installationTaskList);
    const getClassificationBadgeClass = (classification?: string) => {
        if (classification === 'I1') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (classification === 'I2') return 'bg-violet-100 text-violet-700 border-violet-200';
        if (classification === 'I3') return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };
    const getExpectedDeliveryMeta = (expectedDeliveryDate?: string) => {
        if (!expectedDeliveryDate) {
            return {
                label: '-',
                badgeLabel: 'Not Set',
                badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
            };
        }

        const deliveryDate = new Date(expectedDeliveryDate);
        if (Number.isNaN(deliveryDate.getTime())) {
            return {
                label: expectedDeliveryDate,
                badgeLabel: 'Unknown',
                badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deliveryDate.setHours(0, 0, 0, 0);
        const overdue = deliveryDate < today;

        return {
            label: deliveryDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }),
            badgeLabel: overdue ? 'Overdue' : 'Upcoming',
            badgeClass: overdue
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
        };
    };

    const canRequestDeletion = (project: Project) => {
        return (
            activeTab === 'active' &&
            project.currentStage !== 'DROPPED' &&
            project.currentStage !== 'COMPLETED' &&
            project.deletionRequestStatus !== 'PENDING'
        );
    };

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />
                
                <div className="px-4 lg:px-12 py-6 lg:py-10 pb-32">
                    <EmbeddedUserDashboard
                        projects={[...tabProjects.upcoming, ...tabProjects.active, ...tabProjects.done]}
                        userFirstName={user?.name?.split(' ')[0]}
                        showGreeting
                    />

                    {/* Header */}
                    <div className="mb-8 animate-premium">
                        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">
                            Installation & Completion
                        </h1>
                        <p className="text-gray-600 text-sm lg:text-base font-medium">
                            Track installation progress and mark projects complete
                        </p>
                    </div>

                    {/* Tabs */}
                    <Tabs tabs={tabs} activeTab={activeTab} onChange={(tabId) => setActiveTab(tabId as 'upcoming' | 'active' | 'done')} />

                    {/* Search Bar */}
                    <div className="glass-panel rounded-2xl p-4 mb-6 animate-premium shadow-lg">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'done' ? 'Search by customer name...' : 'Search by customer, contact person, or phone...'}
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="w-full pl-12 pr-14 py-3 bg-white/50 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-sm font-medium placeholder:text-gray-400"
                                />
                                {activeTab === 'done' && (
                                    <button
                                        type="button"
                                        onClick={handleCompletedSearch}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                                        disabled={loading}
                                        aria-label="Search completed projects"
                                    >
                                        <Search size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {classificationOptions.map((option) => {
                                    const isActive = classificationFilter === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setClassificationFilter(option)}
                                            className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition-all ${
                                                isActive
                                                    ? 'border-brand-500 bg-brand-600 text-white shadow-md'
                                                    : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white'
                                            }`}
                                        >
                                            {option === 'ALL' ? 'All Classifications' : option}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {activeTab === 'done' && (
                        <div className="glass-panel rounded-2xl p-4 mb-6 animate-premium shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-700">Page {donePage} of {doneTotalPages}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => loadProjects('done', true, donePage - 1, completedSearch)}
                                    disabled={loading || donePage <= 1}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-50 w-full sm:w-auto"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadProjects('done', true, donePage + 1, completedSearch)}
                                    disabled={loading || donePage >= doneTotalPages}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-50 w-full sm:w-auto"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Projects List */}
                    <div className="grid gap-6">
                        {loading ? (
                            <div className="glass-panel rounded-2xl p-12 text-center animate-premium">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto"></div>
                                <p className="text-gray-600 mt-4 font-medium">Loading projects...</p>
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="glass-panel rounded-2xl p-12 text-center animate-premium">
                                <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 font-medium">
                                    {activeTab === 'upcoming' && 'No upcoming installation projects.'}
                                    {activeTab === 'active' && 'No active installation projects.'}
                                    {activeTab === 'done' && 'No work-done installation projects yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredProjects.map((project) => (
                                (() => {
                                    const expectedDelivery = getExpectedDeliveryMeta(project.expectedDeliveryDate);
                                    const installationStatusMeta = getInstallationStatusMeta(project.installationStatus);
                                    return (
                                <div className="glass-panel rounded-3xl p-4 sm:p-6 lg:p-8 animate-premium hover:shadow-2xl transition-all duration-300 border border-white/60">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                <h3 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight break-words">
                                                    {project.projectName || project.school}
                                                </h3>
                                                <ExecutiveInfoHover createdBy={getExecutiveDisplayName(project.createdBy)} zone={project.zone} />
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.15em] ${getCardStatusBadge(activeTab)}`}>
                                                    {activeTab}
                                                </span>
                                            </div>
                                            <p className="text-sm lg:text-base font-semibold text-gray-600 mb-4">{project.school}</p>
                                            <div className="inline-flex">
                                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl ${getStageGradient()} text-white shadow-md`}>
                                                    <Building2 size={14} />
                                                    {project.currentStage}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-row items-center gap-3 w-full lg:w-auto lg:justify-end">
                                            <button
                                                onClick={() => handleViewDetails(project)}
                                                className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-slate-700 font-semibold text-sm transition-colors"
                                            >
                                                <Eye size={16} />
                                                View
                                            </button>
                                            {(activeTab === 'active' || activeTab === 'upcoming') && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedProject(project);
                                                        setShowStatusModal(true);
                                                    }}
                                                    className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold text-sm hover:shadow-lg transition-all text-center"
                                                >
                                                    <Edit2 size={16} className="shrink-0" />
                                                    <span className="truncate">Mark Work Done</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-5 grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                                        <div className="h-full rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4">
                                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Location</p>
                                            <p className="text-sm sm:text-lg font-bold text-slate-900 mt-2">{project.place || 'Not set'}{project.district ? `, ${project.district}` : ''}</p>
                                        </div>
                                        <div className="h-full rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4">
                                            <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3">
                                                <div>
                                                    <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Expected Delivery</p>
                                                    <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1 sm:mt-2">{expectedDelivery.label}</p>
                                                </div>
                                                <span className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] ${expectedDelivery.badgeClass}`}>
                                                    {expectedDelivery.badgeLabel}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-full col-span-2 xl:col-span-1 rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4">
                                            <div className="flex flex-row items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Work Status</p>
                                                    <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1 sm:mt-2">{installationStatusMeta.label}</p>
                                                </div>
                                                <span className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] ${installationStatusMeta.badgeClass}`}>
                                                    {installationStatusMeta.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {getInstallationItems(project).length > 0 && (
                                        <div className="mt-5 rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/90 to-white/85 p-4">
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center rounded-full bg-teal-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                                    Installation Tasks
                                                </span>
                                                <span className="text-xs font-semibold text-teal-700">
                                                    {getInstallationItems(project).length} item{getInstallationItems(project).length > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2.5">
                                                {getInstallationItems(project).map((item, itemIndex) => (
                                                    <div
                                                        key={`${project.id}-${item}-${itemIndex}`}
                                                        className="inline-flex max-w-full items-start gap-2 rounded-2xl border border-teal-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
                                                    >
                                                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                                                        <span className="break-words">{item}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(project.contactPerson || project.contactNumber || project.place || project.schoolLocationLink || canRequestDeletion(project)) && (
                                        <div className="mt-5 pt-5 border-t border-slate-200/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                                                {project.contactPerson && <span className="inline-flex items-center gap-1.5"><User size={14} /> {project.contactPerson}</span>}
                                                {project.contactNumber && <span className="inline-flex items-center gap-1.5"><Phone size={14} /> {project.contactNumber}</span>}
                                                {project.place && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {project.place}{project.district ? `, ${project.district}` : ''}</span>}
                                                {project.schoolLocationLink && (
                                                    <a
                                                        href={project.schoolLocationLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <MapPin size={12} />
                                                        Open Customer Location
                                                    </a>
                                                )}
                                            </div>
                                            {canRequestDeletion(project) && (
                                                <button
                                                    onClick={() => handleDeletionRequest(project)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 border border-red-200 self-start lg:self-auto"
                                                >
                                                    <AlertCircle size={14} />
                                                    Request Deletion
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                    );
                                })()
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Installation Status Modal */}
            {showStatusModal && selectedProject && (
                <InstallationStatusModal
                    project={selectedProject}
                    onClose={() => {
                        setShowStatusModal(false);
                        setSelectedProject(null);
                    }}
                    onSubmit={(formData) => handleUpdateInstallation(selectedProject.id, formData)}
                />
            )}

            {/* Project Details Modal */}
            {showDetailsModal && selectedProject && (
                <ProjectDetailsModal
                    project={selectedProject}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedProject(null);
                    }}
                />
            )}

            {projectForDeletion && (
                <ProjectDeletionRequestModal
                    isOpen={!!projectForDeletion}
                    projectName={projectForDeletion.school}
                    onClose={() => setProjectForDeletion(null)}
                    onSubmit={submitDeletionRequest}
                />
            )}
        </div>
    );
};

// Installation Status Modal Component
const InstallationStatusModal: React.FC<{
    project: Project;
    onClose: () => void;
    onSubmit: (data: UpdateInstallationDataRequest) => Promise<void>;
}> = ({ project, onClose, onSubmit }) => {
    const [formData, setFormData] = useState<UpdateInstallationDataRequest>({
        installationStatus: project.installationStatus || 'PENDING',
        completionDate: project.completionDate || '',
        installationRemarks: project.installationRemarks || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        const completionStatus = formData.installationStatus === 'WORK_DONE';
        if (completionStatus && !formData.completionDate) {
            setValidationError('Work Done Date is required');
            return;
        }
        setValidationError(null);
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusPreview = (status: InstallationStatus) => {
        switch (status) {
            case 'WORK_DONE':
                return { color: 'bg-green-100 text-green-700 border-green-300', icon: <CheckCircle size={18} />, label: 'Work Done - Installation completed successfully' };
            case 'NOT_DONE':
                return { color: 'bg-red-100 text-red-700 border-red-300', icon: <XCircle size={18} />, label: 'Not Done - Installation not completed' };
            case 'PENDING':
                return { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: <Clock size={18} />, label: 'Pending - Awaiting installation' };
        }
    };

    return (
        <StandardModuleModal
            title="Update Installation Status"
            subtitle={project.school}
            icon={<Wrench size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-2xl"
        >
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6">
                    {/* Installation Status Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Installation Status</label>
                        <div className="space-y-3">
                            {(['PENDING', 'WORK_DONE', 'NOT_DONE'] as InstallationStatus[]).map((status) => {
                                const preview = getStatusPreview(status);
                                return (
                                    <label 
                                        key={status}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                            formData.installationStatus === status 
                                                ? `${preview.color} border-current shadow-md scale-[1.02]` 
                                                : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="installationStatus"
                                            value={status}
                                            checked={formData.installationStatus === status}
                                            onChange={(e) => {
                                                setFormData({ ...formData, installationStatus: e.target.value as InstallationStatus });
                                                setValidationError(null);
                                            }}
                                            className="w-5 h-5"
                                        />
                                        <div className="flex items-center gap-2 flex-1">
                                            {preview.icon}
                                            <span className="text-sm font-semibold">{preview.label}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Work Done Date Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} />
                                Work Done Date
                            </div>
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={formData.completionDate || ''}
                                onChange={(e) => {
                                    setFormData({ ...formData, completionDate: e.target.value });
                                    setValidationError(null);
                                }}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-medium"
                            />
                        </div>
                        {validationError && (
                            <p className="text-sm text-red-600 font-medium mt-2">{validationError}</p>
                        )}
                        {formData.completionDate && (
                            <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <p className="text-sm text-purple-700 font-medium">
                                    Selected: {new Date(formData.completionDate).toLocaleDateString('en-GB', { 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                    })}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Installation Remarks Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                            <div className="flex items-center gap-2">
                                <FileText size={14} />
                                Installation Remarks
                            </div>
                        </label>
                        <textarea
                            value={formData.installationRemarks || ''}
                            onChange={(e) => setFormData({ ...formData, installationRemarks: e.target.value })}
                            rows={5}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base resize-none"
                            placeholder="Enter detailed installation notes, observations, or any special remarks..."
                        />
                        <p className="text-xs text-gray-500 mt-2">{formData.installationRemarks?.length || 0} characters</p>
                    </div>

                    {/* Info Panel */}
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                        <div className="flex gap-3">
                            <AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <p className="font-semibold mb-1">Important</p>
                                <p>Make sure all installation details are accurate before submitting. This information will be visible to the team.</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold text-gray-700 transition-all hover:shadow-md w-full sm:w-auto"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:shadow-xl font-bold transition-all w-full sm:w-auto"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
        </StandardModuleModal>
    );
};

// Project Details Modal Component
const ProjectDetailsModal: React.FC<{
    project: Project;
    onClose: () => void;
}> = ({ project, onClose }) => {
    // Support standard comma plus common mobile keyboard comma variants, and new lines.
    const installationItems = parseInstallationItems(project.installationTaskList);

    const getInstallationStatusDisplay = (status?: InstallationStatus) => {
        switch (status) {
            case 'WORK_DONE':
                return { 
                    color: 'bg-gradient-to-r from-green-500 to-emerald-600', 
                    icon: <CheckCircle size={24} />, 
                    label: 'WORK DONE',
                    textColor: 'text-white'
                };
            case 'NOT_DONE':
                return { 
                    color: 'bg-gradient-to-r from-red-500 to-rose-600', 
                    icon: <XCircle size={24} />, 
                    label: 'NOT DONE',
                    textColor: 'text-white'
                };
            case 'PENDING':
            default:
                return { 
                    color: 'bg-gradient-to-r from-yellow-500 to-amber-600', 
                    icon: <Clock size={24} />, 
                    label: 'PENDING',
                    textColor: 'text-white'
                };
        }
    };

    const statusDisplay = getInstallationStatusDisplay(project.installationStatus);

    return (
        <StandardModuleModal
            title="Installation Details"
            subtitle={project.school}
            icon={<Eye size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-3xl"
        >
                <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                    {/* Customer Information */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Building2 size={20} className="text-blue-600" />
                            Customer Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Customer Name</p>
                                <p className="text-base font-bold text-gray-900">{project.school}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current Stage</p>
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold rounded-lg">
                                    {project.currentStage}
                                </span>
                            </div>
                            {project.projectClassification && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Classification</p>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.15em] ${project.projectClassification === 'I1' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : project.projectClassification === 'I2' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200'}`}>
                                        {project.projectClassification}
                                    </span>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Location</p>
                                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <MapPin size={14} className="text-gray-500" />
                                    {project.place}, {project.district}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Extra Work Needed</p>
                                <p className="text-base font-semibold text-gray-900">{project.isExtraWorkNeeded ? 'Yes' : 'No'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Installation Status Section */}
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border-2 border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Wrench size={20} className="text-gray-700" />
                            Installation Status
                        </h3>
                        <div className={`${statusDisplay.color} rounded-xl p-5 shadow-lg mb-4`}>
                            <div className="flex items-center gap-3 text-white">
                                {statusDisplay.icon}
                                <span className="text-xl font-bold">{statusDisplay.label}</span>
                            </div>
                        </div>
                        
                        {project.completionDate && (
                            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-4">
                                <p className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-2">Work Done Date</p>
                                <div className="flex items-center gap-2">
                                    <Calendar size={20} className="text-purple-600" />
                                    <span className="text-base font-bold text-purple-900">
                                        {new Date(project.completionDate).toLocaleDateString('en-GB', { 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        })}
                                    </span>
                                </div>
                            </div>
                        )}

                        {project.installationRemarks && (
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Installation Remarks</p>
                                <div className="flex gap-3">
                                    <FileText size={18} className="text-blue-600 shrink-0 mt-1" />
                                    <p className="text-sm text-gray-700 leading-relaxed">{project.installationRemarks}</p>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Contact Information */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <User size={20} className="text-green-600" />
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Contact Person</p>
                                <p className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                    <User size={16} className="text-green-600" />
                                    {project.contactPerson || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Contact Number</p>
                                <p className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                    <Phone size={16} className="text-green-600" />
                                    {project.contactNumber || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sales Information */}
                    {(project.projectClassification || project.invoiceAmount !== undefined) && (
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Sales Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {project.projectClassification && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Classification</p>
                                        <p className="text-base font-semibold text-gray-900">{project.projectClassification}</p>
                                    </div>
                                )}
                                {project.invoiceAmount !== undefined && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Invoice Amount</p>
                                        <p className="text-lg font-bold text-orange-700">₹{project.invoiceAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Installation Items */}
                    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-6 border-2 border-teal-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Installation Items</h3>
                        {installationItems.length > 0 ? (
                            <ul className="space-y-2">
                                {installationItems.map((item, index) => (
                                    <li key={`${item}-${index}`} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                                        <span className="text-teal-700 mt-1">•</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-600">No items available</p>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold text-gray-700 transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
        </StandardModuleModal>
    );
};
