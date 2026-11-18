import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { Tabs } from '../components/ui/Tabs';
import { Project, UpdateSalesDataRequest, ProjectViewBucket, ProjectClassification } from '../types';
import { projectApi, usersApi } from '../services/api';
import { Search, DollarSign, FileText, Calendar, Building2, MapPin, Send, CheckCircle, AlertCircle, Edit2, Eye, Phone, User, TrendingUp, PackageCheck, Info, Download } from 'lucide-react';
import { parseIndianNumber, formatIndianNumber } from '../utils/numberFormat';
import { exportToCSV } from '../utils';
import { ProjectDeletionRequestModal } from '../components/ui/ProjectDeletionRequestModal';
import { StandardModuleModal } from '../components/ui/StandardModuleModal';
import { EmbeddedUserDashboard } from '../components/dashboard/EmbeddedUserDashboard';

const PROJECT_CLASSIFICATIONS: ProjectClassification[] = ['I1', 'I2', 'I3'];

const formatZoneLabel = (zone?: string) => {
    if (!zone) return 'N/A';
    return zone.replace(/_/g, ' ');
};

const formatCsvDate = (date?: string) => {
    if (!date) return '';
    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString('en-GB');
};

const safeCsvFilenamePart = (value?: string) =>
    (value || 'project')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'project';

const formatExecutiveSheetValue = (value?: string) =>
    (value || '')
        .split('_')
        .map((word) => word ? `${word.charAt(0)}${word.slice(1).toLowerCase()}` : '')
        .join(' ');

const buildSalesProjectCsvRow = (project: Project) => {
    return {
        'Project ID': project.id,
        'Customer': project.school,
        'Project Name': project.projectName || '',
        'Parent Company': project.parentCompany || '',
        'Contact Person': project.contactPerson || '',
        'Contact Number': project.contactNumber || '',
        'Cluster': project.brc || '',
        'Category': formatExecutiveSheetValue(project.projectCategory),
        'Project': formatExecutiveSheetValue(project.projectType),
        'Enquiry': formatExecutiveSheetValue(project.enquiryType),
        'Last Visit': formatCsvDate(project.lastVisitDate),
        'Executive Remark': project.executiveRemarks || '',
        'Need Help': formatExecutiveSheetValue(project.needHelp),
        'Sales Office': project.salesOffice ? 'TRUE' : 'FALSE',
        'Sales Head': project.salesHead ? 'TRUE' : 'FALSE',
        'Sales Office Remark': formatExecutiveSheetValue(project.salesOfficeRemark),
        'Place': project.place || '',
        'District': project.district || '',
        'Zone': formatZoneLabel(project.zone),
        'Project Stage': project.currentStage,
        'Project Value (INR)': project.projectValue ?? 0,
        'Invoice Amount (INR)': project.invoiceAmount ?? 0,
        'Project Classification': project.projectClassification || '',
        'Expected Delivery Date': formatCsvDate(project.expectedDeliveryDate),
        'Installation Task List': project.installationTaskList || '',
        'Quotation Remarks': project.quotationRemarks || '',
        'Sales Remarks': project.salesRemarks || '',
        'Sales Owner': project.salesUserEmail || '',
        'Sales Entry Date': formatCsvDate(project.salesEntryDate),
        'Payment': project.paymentStatus || 'PENDING',
        'Created Date': formatCsvDate(project.createdDate),
        'Last Updated': formatCsvDate(project.lastUpdatedAt)
    };
};

const exportSalesProjectCsv = (project: Project) => {
    exportToCSV(
        [buildSalesProjectCsvRow(project)],
        `sales-project-${project.id}-${safeCsvFilenamePart(project.school)}.csv`
    );
};

const ExecutiveInfoHover: React.FC<{ createdBy?: string; zone?: string }> = ({ createdBy, zone }) => {
    if (!createdBy && !zone) return null;
    return (
        <div className="inline-flex items-center gap-3">
            <span className="hidden sm:inline text-slate-300 font-light">|</span>
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

export const SalesCoordinatorPage: React.FC = () => {
    const { user, isDemo } = useAuth();
    const { showToast } = useToast();
    const { isSidebarCollapsed, showSidebar } = useLayout();
    const [tabProjects, setTabProjects] = useState<Record<'active' | 'done', Project[]>>({
        active: [],
        done: []
    });
    const [tabLoading, setTabLoading] = useState<Record<'active' | 'done', boolean>>({
        active: false,
        done: false
    });
    const [tabLoaded, setTabLoaded] = useState<Record<'active' | 'done', boolean>>({
        active: false,
        done: false
    });
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [projectForDeletion, setProjectForDeletion] = useState<Project | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [completedSearch, setCompletedSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'active' | 'done'>('active');
    const [tabCounts, setTabCounts] = useState<Record<'active', number>>({
        active: 0
    });
    const [doneCount, setDoneCount] = useState(0);
    const [donePage, setDonePage] = useState(1);
    const [doneTotalPages, setDoneTotalPages] = useState(1);
    const [executiveNamesByEmail, setExecutiveNamesByEmail] = useState<Record<string, string>>({});
    const completedSearchRef = useRef('');
    const didInitRef = useRef(false);
    const tabLoadingRef = useRef<Record<'active' | 'done', boolean>>({
        active: false,
        done: false
    });
    const tabLoadedRef = useRef<Record<'active' | 'done', boolean>>({
        active: false,
        done: false
    });
    const tabFailedRef = useRef<Record<'active' | 'done', boolean>>({
        active: false,
        done: false
    });
    const loading = tabLoading[activeTab];
    const donePageSize = 10;
    const useAdminBadgeCounts = isDemo || user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_SUPER_ADMIN' || user?.role === 'ROLE_OPERATOR';

    const loadProjects = React.useCallback(async (tab: 'active' | 'done', force = false, targetPage = 1, targetSearch = completedSearchRef.current) => {
        if (tabLoadingRef.current[tab] || ((tabLoadedRef.current[tab] || tabFailedRef.current[tab]) && !force)) return;
        try {
            if (force) {
                tabFailedRef.current = { ...tabFailedRef.current, [tab]: false };
            }
            tabLoadingRef.current = { ...tabLoadingRef.current, [tab]: true };
            setTabLoading((prev) => ({ ...prev, [tab]: true }));
            if (tab === 'done') {
                const pageData = await projectApi.getDashboardCompletedProjectsPaged('SALES', undefined, targetSearch, targetPage, donePageSize);
                const normalizedData = (pageData.content || []).filter((p) => p.currentStage !== 'DROPPED');
                setTabProjects((prev) => ({ ...prev, done: normalizedData }));
                setDoneCount(pageData.totalElements || 0);
                setDonePage((pageData.number ?? 0) + 1);
                setDoneTotalPages(Math.max(pageData.totalPages || 0, 1));
            } else {
                const data = await projectApi.getSalesProjects();
                setTabProjects((prev) => ({ ...prev, [tab]: data }));
                setTabCounts((prev) => ({ ...prev, active: data.length }));
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
                ? await projectApi.getAdminDashboardBadgeCounts('SALES')
                : await projectApi.getDashboardBadgeCounts('SALES');
            setDoneCount(counts.completedCount || 0);
        } catch (error: any) {
            showToast(error.message || 'Failed to load sales counts', 'error');
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
        setActiveTab('active');
        setTabProjects({ active: [], done: [] });
        setTabLoading({ active: false, done: false });
        setTabLoaded({ active: false, done: false });
        setSearchInput('');
        setCompletedSearch('');
        setTabCounts({ active: 0 });
        setDoneCount(0);
        setDonePage(1);
        setDoneTotalPages(1);
        tabLoadingRef.current = { active: false, done: false };
        tabLoadedRef.current = { active: false, done: false };
        tabFailedRef.current = { active: false, done: false };
        void loadBadgeCounts();
        void loadProjects('active');
    }, []);

    const isCurrentTabLoaded = tabLoaded[activeTab];
    const isCurrentTabLoading = tabLoading[activeTab];
    const isCurrentTabFailed = tabFailedRef.current[activeTab];

    useEffect(() => {
        if (!isCurrentTabLoaded && !isCurrentTabLoading && !isCurrentTabFailed) {
            loadProjects(activeTab);
        }
    }, [activeTab, isCurrentTabFailed, isCurrentTabLoaded, isCurrentTabLoading, loadProjects]);

    const reconcileSalesProject = (updated: Project) => {
        setTabProjects((prev) => {
            const withoutProject = {
                active: prev.active.filter((p) => p.id !== updated.id),
                done: prev.done.filter((p) => p.id !== updated.id)
            };

            if (updated.currentStage !== 'SALES') {
                return withoutProject;
            }

            const targetTab = updated.viewBucket === 'DONE' ? 'done' : 'active';
            return {
                ...withoutProject,
                [targetTab]: [updated, ...withoutProject[targetTab]]
            };
        });
    };

    const handleUpdateSalesData = async (projectId: number, formData: UpdateSalesDataRequest) => {
        try {
            const updated = await projectApi.updateSalesData(projectId, formData);
            reconcileSalesProject(updated);
            showToast('Sales data updated successfully', 'success');
            setShowEditModal(false);
            setSelectedProject(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to update sales data', 'error');
        }
    };

    const handleMarkReadyForAccounts = async (projectId: number) => {
        try {
            const updated = await projectApi.markReadyForAccounts(projectId);
            reconcileSalesProject(updated);
            showToast('Project moved to Accounts', 'success');
            if (tabLoaded.done) {
                loadProjects('done', true, donePage, completedSearch);
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to move to Accounts', 'error');
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
            loadProjects('active', true);
            if (tabLoaded.done) {
                loadProjects('done', true, donePage, completedSearch);
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to submit deletion request', 'error');
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

    const handleCompletedSearch = () => {
        if (activeTab !== 'done') return;
        const normalizedSearch = searchInput.trim();
        setCompletedSearch(normalizedSearch);
        setDonePage(1);
        loadProjects('done', true, 1, normalizedSearch);
    };

    // Filter projects based on active tab and search
    const filteredProjects = React.useMemo(() => {
        if (activeTab === 'done') {
            return tabProjects.done;
        }
        const lowerSearchTerm = searchInput.toLowerCase();
        const tabFiltered = tabProjects[activeTab];

        return tabFiltered.filter(p => 
            (p.school || '').toLowerCase().includes(lowerSearchTerm) ||
            (p.contactPerson || '').toLowerCase().includes(lowerSearchTerm) ||
            (p.contactNumber || '').includes(searchInput)
        );
    }, [tabProjects, searchInput, activeTab]);

    const handleBulkSalesExport = async () => {
        try {
            const projectsToExport = activeTab === 'done'
                ? (await Promise.all(
                    Array.from({ length: doneTotalPages }, (_, index) =>
                        projectApi.getDashboardCompletedProjectsPaged('SALES', undefined, completedSearch, index + 1, donePageSize)
                    )
                )).flatMap((page) => page.content || []).filter((project) => project.currentStage !== 'DROPPED')
                : filteredProjects;

            if (!projectsToExport.length) {
                showToast('No projects are available to export.', 'error');
                return;
            }

            exportToCSV(
                projectsToExport.map(buildSalesProjectCsvRow),
                `billing-${activeTab}-projects-${new Date().toISOString().slice(0, 10)}.csv`
            );
            showToast(`${projectsToExport.length} projects exported to CSV.`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export billing projects.', 'error');
        }
    };

    const tabs = [
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

    const formatCurrency = (amount?: number) => {
        if (!amount) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
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
                        projects={[...tabProjects.active, ...tabProjects.done]}
                        userFirstName={user?.name?.split(' ')[0]}
                        showGreeting
                    />

                    {/* Header */}
                    <div className="mb-8 animate-premium flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">
                                Sales Coordinator
                            </h1>
                            <p className="text-gray-600 text-sm lg:text-base font-medium">
                                Manage quotations and prepare projects for accounts
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleBulkSalesExport}
                            disabled={loading || filteredProjects.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download size={16} />
                            Export all {activeTab === 'done' ? 'completed' : 'filtered'} CSV
                        </button>
                    </div>

                    {/* Tabs */}
                    <Tabs tabs={tabs} activeTab={activeTab} onChange={(tabId) => setActiveTab(tabId as 'active' | 'done')} />

                    {/* Search Bar */}
                    <div className="glass-panel rounded-2xl p-4 mb-6 animate-premium shadow-lg">
                        <div className="relative">
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
                                    {activeTab === 'active' ? 'No active projects to work on.' : 'No completed projects yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredProjects.map((project) => (
                                <div key={project.id} className="glass-panel rounded-3xl p-4 sm:p-6 lg:p-8 animate-premium hover:shadow-2xl transition-all duration-300 border border-white/60">
                                    {/* Project Header */}
                                    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
                                        <div className="flex-1 min-w-0">
                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <h3 className="text-xl font-black tracking-tight text-slate-900">{project.school}</h3>
                                                <ExecutiveInfoHover createdBy={getExecutiveDisplayName(project.createdBy)} zone={project.zone} />
                                            </div>
                                            {project.projectName && (
                                                <p className="text-sm font-semibold">
                                                    <span className="text-slate-900">Work : </span>
                                                    <span className="text-brand-700">{project.projectName}</span>
                                                </p>
                                            )}
                                            <div className="mt-3 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 w-full">
                                                    {project.contactPerson && (
                                                        <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-2xl sm:rounded-full border border-slate-200 bg-white/70 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-600">
                                                            <User size={16} className="shrink-0" />
                                                            <span className="truncate">{project.contactPerson}</span>
                                                        </span>
                                                    )}
                                                    {project.salesEntryDate && (
                                                        <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-2xl sm:rounded-full border border-slate-200 bg-white/70 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-600">
                                                            <Calendar size={16} className="shrink-0" />
                                                            <span className="truncate">
                                                                {new Date(project.salesEntryDate).toLocaleDateString('en-GB', {
                                                                    day: '2-digit', 
                                                                    month: '2-digit', 
                                                                    year: '2-digit' 
                                                                })}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 w-full">
                                                    {project.place && (
                                                        <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-2xl sm:rounded-full border border-slate-200 bg-white/70 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-600">
                                                            <MapPin size={16} className="shrink-0" />
                                                            <span className="truncate">{project.place}, {project.district}</span>
                                                        </span>
                                                    )}
                                                    <span className="flex-1 min-w-0 inline-flex items-center justify-center rounded-2xl sm:rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-sm">
                                                        <span className="truncate">{project.currentStage}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Metrics in Colored Blocks */}
                                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 mb-6">
                                        {/* Project Value Block */}
                                        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4 min-h-[96px]">
                                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Project Value</p>
                                            <p className="text-sm sm:text-lg font-bold text-slate-900 mt-2">{formatCurrency(project.projectValue)}</p>
                                        </div>

                                        {/* Invoice Amount Block */}
                                        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4 min-h-[96px]">
                                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Invoice Amount</p>
                                            <p className="text-sm sm:text-lg font-bold text-slate-900 mt-2">{formatCurrency(project.invoiceAmount)}</p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4 min-h-[96px]">
                                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Current Stage</p>
                                            <p className="text-sm sm:text-lg font-bold text-slate-900 mt-2">{project.currentStage}</p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 sm:p-4 min-h-[96px]">
                                            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Expected Delivery</p>
                                            <p className="text-sm sm:text-lg font-bold text-slate-900 mt-2">
                                                {project.expectedDeliveryDate
                                                    ? new Date(project.expectedDeliveryDate).toLocaleDateString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Sales Remarks Section */}
                                    {project.salesRemarks && (
                                        <div className="mb-6 bg-amber-50/80 border border-amber-200 rounded-2xl p-4">
                                            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">
                                                Sales Remarks
                                            </p>
                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                {project.salesRemarks}
                                            </p>
                                        </div>
                                    )}

                                    {/* Stage Badge and Info */}
                                    <div className="flex flex-wrap items-center gap-3 mb-6">

                                        {project.deletionRequestStatus === 'PENDING' && (
                                            <>
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                                    Frozen
                                                </span>
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                    Pending Deletion Approval
                                                </span>
                                            </>
                                        )}
                                        {project.expectedDeliveryDate && (
                                            <div className="text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2">
                                                <Calendar size={14} />
                                                <span>
                                                    Expected: {new Date(project.expectedDeliveryDate).toLocaleDateString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto">
                                            <button
                                                onClick={() => handleViewDetails(project)}
                                                className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-brand-100 bg-brand-50/80 px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all hover:bg-brand-100 min-w-0"
                                            >
                                                <Eye size={16} className="shrink-0" />
                                                <span className="truncate">View</span>
                                            </button>
                                            {activeTab === 'active' && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedProject(project);
                                                        setShowEditModal(true);
                                                    }}
                                                    className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 min-w-0"
                                                >
                                                    <Edit2 size={16} className="shrink-0" />
                                                    <span className="truncate">Edit</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => exportSalesProjectCsv(project)}
                                                className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 min-w-0"
                                                title={`Export ${project.school} to CSV`}
                                                aria-label={`Export ${project.school} to CSV`}
                                            >
                                                <Download size={16} className="shrink-0" />
                                                <span className="truncate">Export CSV</span>
                                            </button>
                                        </div>
                                        {activeTab === 'active' && (
                                            <button
                                                onClick={() => handleMarkReadyForAccounts(project.id)}
                                                className="w-full lg:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all text-sm font-bold flex items-center justify-center gap-2 shrink-0"
                                            >
                                                <span className="truncate">Mark Ready for Accounts</span>
                                                <CheckCircle size={16} className="shrink-0" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Sales Data Modal */}
            {showEditModal && selectedProject && (
                <SalesEditModal
                    project={selectedProject}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedProject(null);
                    }}
                    onSubmit={(formData) => handleUpdateSalesData(selectedProject.id, formData)}
                    onRequestDeletion={canRequestDeletion(selectedProject) ? () => {
                        setShowEditModal(false);
                        handleDeletionRequest(selectedProject);
                    } : undefined}
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

// Sales Edit Modal Component
const SalesEditModal: React.FC<{
    project: Project;
    onClose: () => void;
    onSubmit: (data: UpdateSalesDataRequest) => void;
    onRequestDeletion?: () => void;
}> = ({ project, onClose, onSubmit, onRequestDeletion }) => {
    const [invoiceError, setInvoiceError] = useState('');
    const [classificationError, setClassificationError] = useState('');
    const [formData, setFormData] = useState<UpdateSalesDataRequest>({
        invoiceAmount: project.invoiceAmount,
        quotationRemarks: project.quotationRemarks || '',
        expectedDeliveryDate: project.expectedDeliveryDate || '',
        salesRemarks: project.salesRemarks || '',
        installationTaskList: project.installationTaskList || '',
        projectClassification: project.projectClassification
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.invoiceAmount == null || formData.invoiceAmount <= 0) {
            setInvoiceError('Invoice amount must be greater than zero.');
            return;
        }
        if (!formData.projectClassification) {
            setClassificationError('Project Classification is required.');
            return;
        }
        setClassificationError('');
        onSubmit(formData);
    };

    return (
        <StandardModuleModal
            title="Edit Sales Data"
            subtitle={project.school}
            icon={<Edit2 size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-3xl"
        >
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6">
                    <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 font-medium">
                        Project Value is captured by Executive. Invoice Amount is managed by Sales.
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <DollarSign size={18} className="text-brand-600" />
                            Financial Input
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Invoice Amount (₹)
                            </label>
                            <input
                                type="text"
                                value={formData.invoiceAmount != null ? formatIndianNumber(formData.invoiceAmount.toString()) : ''}
                                onChange={(e) => {
                                    const parsed = parseIndianNumber(e.target.value);
                                    setFormData({ ...formData, invoiceAmount: parsed });
                                    if (parsed > 0) setInvoiceError('');
                                }}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                                placeholder="Enter invoice amount"
                            />
                            {invoiceError && (
                                <p className="text-xs text-red-600 font-medium">{invoiceError}</p>
                            )}
                        </div>
                    </div>

                    {/* Delivery Information Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <PackageCheck size={20} className="text-brand-600" />
                            Delivery Information
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Project Classification <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {PROJECT_CLASSIFICATIONS.map((classification) => (
                                    <button
                                        key={classification}
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, projectClassification: classification });
                                            setClassificationError('');
                                        }}
                                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                                            formData.projectClassification === classification
                                                ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg'
                                                : 'bg-white/60 text-gray-700 border border-gray-200 hover:bg-white'
                                        }`}
                                    >
                                        {classification}
                                    </button>
                                ))}
                            </div>
                            {classificationError && (
                                <p className="text-xs text-red-600 font-medium">{classificationError}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Expected Delivery Date
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Calendar size={18} />
                                </div>
                                <input
                                    type="date"
                                    value={formData.expectedDeliveryDate || ''}
                                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Remarks Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={20} className="text-brand-600" />
                            Remarks & Notes
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Installation Task List <span className="text-gray-400 font-medium">(max 1200 chars)</span>
                            </label>
                            <textarea
                                value={formData.installationTaskList || ''}
                                onChange={(e) => setFormData({ ...formData, installationTaskList: e.target.value })}
                                rows={4}
                                maxLength={1200}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium resize-none"
                                placeholder="Enter tasks separated by commas (e.g., Router setup, CCTV installation, Wiring)."
                            />
                            <p className="text-xs text-gray-500">
                                Enter tasks separated by commas (e.g., Router setup, CCTV installation, Wiring).
                            </p>
                            <p className="text-xs text-gray-500 text-right">
                                {(formData.installationTaskList || '').length}/1200
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Quotation Remarks
                            </label>
                            <textarea
                                value={formData.quotationRemarks || ''}
                                onChange={(e) => setFormData({ ...formData, quotationRemarks: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium resize-none"
                                placeholder="Enter quotation remarks..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Sales Remarks
                            </label>
                            <textarea
                                value={formData.salesRemarks || ''}
                                onChange={(e) => setFormData({ ...formData, salesRemarks: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium resize-none"
                                placeholder="Enter sales remarks..."
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-200">
                        {onRequestDeletion ? (
                            <button type="button" onClick={onRequestDeletion} className="w-full sm:w-auto rounded-2xl border border-red-200 bg-red-50 px-6 py-3 font-semibold text-red-700 transition-all hover:bg-red-100 flex items-center justify-center gap-2 shrink-0">
                                <AlertCircle size={18} />
                                Request Deletion
                            </button>
                        ) : <div />}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold text-gray-700 transition-all w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold w-full sm:w-auto"
                            >
                                Save Changes
                            </button>
                        </div>
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
    const installationItems = (project.installationTaskList || '')
        .split(/[\n,，،]+/)
        .map(item => item.trim())
        .filter(Boolean);

    const formatCurrency = (amount?: number) => {
        if (!amount) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    return (
        <StandardModuleModal
            title="Project Details"
            subtitle={project.school}
            icon={<Eye size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-3xl"
        >
                <div className="p-4 sm:p-6 lg:p-8 space-y-5">
                    {/* Basic Information Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Building2 size={20} className="text-brand-600" />
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Customer Name</p>
                                <p className="font-bold text-gray-900 text-lg">{project.school}</p>
                            </div>
                            {project.projectName && (
                                <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Name</p>
                                    <p className="font-bold text-gray-900 text-lg">{project.projectName}</p>
                                </div>
                            )}
                            <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                    <MapPin size={12} />
                                    Location
                                </p>
                                <p className="font-semibold text-gray-900">{project.place}, {project.district}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Extra Work Needed</p>
                                <p className="font-semibold text-gray-900">{project.isExtraWorkNeeded ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                                <p className="text-xs font-medium text-brand-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                                    <PackageCheck size={12} />
                                    Current Stage
                                </p>
                                <p className="font-bold text-brand-900 text-lg">{project.currentStage}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Information Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <User size={20} className="text-brand-600" />
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                    <User size={12} />
                                    Contact Person
                                </p>
                                <p className="font-semibold text-gray-900">{project.contactPerson || 'N/A'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                    <Phone size={12} />
                                    Contact Number
                                </p>
                                <p className="font-semibold text-gray-900">{project.contactNumber || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Financial Information Section */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <DollarSign size={20} className="text-brand-600" />
                            Financial Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-green-500 rounded-lg">
                                        <TrendingUp size={16} className="text-white" />
                                    </div>
                                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Project Value</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{formatCurrency(project.projectValue)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-blue-500 rounded-lg">
                                        <FileText size={16} className="text-white" />
                                    </div>
                                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Invoice Amount</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{formatCurrency(project.invoiceAmount)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Additional Information */}
                    {(project.salesRemarks || project.quotationRemarks || project.installationTaskList) && (
                        <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <FileText size={20} className="text-brand-600" />
                                Additional Information
                            </h3>
                            {project.salesRemarks && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">Sales Remarks</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{project.salesRemarks}</p>
                                </div>
                            )}
                            {project.installationTaskList && (
                                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                                    <p className="text-xs font-medium text-teal-700 uppercase tracking-wide mb-2">Installation Task List</p>
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
                            )}
                            {project.quotationRemarks && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">Quotation Remarks</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{project.quotationRemarks}</p>
                                </div>
                            )}
                            {project.expectedDeliveryDate && (
                                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center gap-3">
                                    <Calendar size={20} className="text-purple-600" />
                                    <div>
                                        <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Expected Delivery Date</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {new Date(project.expectedDeliveryDate).toLocaleDateString('en-GB', { 
                                                day: 'numeric', 
                                                month: 'long', 
                                                year: 'numeric' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
