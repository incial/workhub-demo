import { paymentPreview } from '../utils';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { Tabs } from '../components/ui/Tabs';
import { Project, UpdateAccountsDataRequest, PaymentStatus } from '../types';
import { projectApi, usersApi } from '../services/api';
import { Search, DollarSign, CreditCard, Calendar, Building2, MapPin, Receipt, CheckCircle, Clock, AlertTriangle, Edit2, Eye, Phone, User, Link, Info, Download } from 'lucide-react';
import { formatIndianNumber, parseIndianNumber } from '../utils/numberFormat';
import { exportToCSV } from '../utils';
import { ProjectDeletionRequestModal } from '../components/ui/ProjectDeletionRequestModal';
import { StandardModuleModal } from '../components/ui/StandardModuleModal';
import { EmbeddedUserDashboard } from '../components/dashboard/EmbeddedUserDashboard';

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

const buildAccountsProjectCsvRow = (project: Project) => {
    const paymentHistory = (project.paymentHistory || [])
        .map((payment) => [
            formatCsvDate(payment.paymentDate),
            payment.amountPaid ?? '',
            payment.remarks || '',
            payment.paymentProofUrl || ''
        ].join(' | '))
        .join('\n');

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
        'Invoice Amount (INR)': project.invoiceAmount ?? 0,
        'Amount Received (INR)': project.amountReceived ?? project.totalReceived ?? 0,
        'Pending Amount (INR)': project.pendingAmount ?? 0,
        'Payment Status': project.paymentStatus || 'PENDING',
        'Last Payment Date': formatCsvDate(project.paymentDate),
        'Expected Delivery Date': formatCsvDate(project.expectedDeliveryDate),
        'Accounts Owner': project.accountsUserEmail || '',
        'Accounts Entry Date': formatCsvDate(project.accountsEntryDate),
        'Payment Remarks': project.paymentRemarks || '',
        'Payment Proof URL': project.paymentProofUrl || '',
        'Installment Count': project.paymentHistory?.length || 0,
        'Installment Details (Date | Amount INR | Remarks | Proof URL)': paymentHistory,
        'Created Date': formatCsvDate(project.createdDate),
        'Last Updated': formatCsvDate(project.lastUpdatedAt)
    };
};

const exportAccountsProjectCsv = (project: Project) => {
    exportToCSV(
        [buildAccountsProjectCsvRow(project)],
        `accounts-project-${project.id}-${safeCsvFilenamePart(project.school)}.csv`
    );
};

const ExecutiveInfoHover: React.FC<{ createdBy?: string; zone?: string }> = ({ createdBy, zone }) => {
    if (!createdBy && !zone) return null;
    return (
        <div className="inline-flex items-center gap-1.5 sm:gap-3 flex-nowrap">
            <span className="text-slate-300 font-light hidden sm:inline">|</span>
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2">
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

export const AccountsPage: React.FC = () => {
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
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showInvoiceAmountModal, setShowInvoiceAmountModal] = useState(false);
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
                const pageData = await projectApi.getDashboardCompletedProjectsPaged('ACCOUNTS', undefined, targetSearch, targetPage, donePageSize);
                const normalizedData = (pageData.content || []).filter((p) => p.currentStage !== 'DROPPED');
                setTabProjects((prev) => ({ ...prev, done: normalizedData }));
                setDoneCount(pageData.totalElements || 0);
                setDonePage((pageData.number ?? 0) + 1);
                setDoneTotalPages(Math.max(pageData.totalPages || 0, 1));
            } else {
                const data = await projectApi.getAccountsProjects();
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
                ? await projectApi.getAdminDashboardBadgeCounts('ACCOUNTS')
                : await projectApi.getDashboardBadgeCounts('ACCOUNTS');
            setDoneCount(counts.completedCount || 0);
        } catch (error: any) {
            showToast(error.message || 'Failed to load accounts counts', 'error');
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

    const reconcileAccountsProject = (updated: Project) => {
        setTabProjects((prev) => {
            const withoutProject = {
                active: prev.active.filter((p) => p.id !== updated.id),
                done: prev.done.filter((p) => p.id !== updated.id)
            };

            if (updated.currentStage !== 'ACCOUNTS') {
                return withoutProject;
            }

            const targetTab = updated.viewBucket === 'DONE' ? 'done' : 'active';
            return {
                ...withoutProject,
                [targetTab]: [updated, ...withoutProject[targetTab]]
            };
        });
    };

    const handleUpdatePayment = async (projectId: number, formData: UpdateAccountsDataRequest) => {
        try {
            const updated = await projectApi.updateAccountsData(projectId, formData);
            reconcileAccountsProject(updated);
            showToast('Payment recorded successfully', 'success');
            setShowPaymentModal(false);
            setSelectedProject(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to update payment data', 'error');
        }
    };

    const handleUpdateInvoiceAmount = async (projectId: number, formData: UpdateAccountsDataRequest) => {
        try {
            const updated = await projectApi.updateAccountsData(projectId, formData);
            reconcileAccountsProject(updated);
            showToast('Invoice amount updated successfully', 'success');
            setShowInvoiceAmountModal(false);
            setSelectedProject(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to update invoice amount', 'error');
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

    const handleBulkAccountsExport = async () => {
        try {
            const projectsToExport = activeTab === 'done'
                ? (await Promise.all(
                    Array.from({ length: doneTotalPages }, (_, index) =>
                        projectApi.getDashboardCompletedProjectsPaged('ACCOUNTS', undefined, completedSearch, index + 1, donePageSize)
                    )
                )).flatMap((page) => page.content || []).filter((project) => project.currentStage !== 'DROPPED')
                : filteredProjects;

            if (!projectsToExport.length) {
                showToast('No projects are available to export.', 'error');
                return;
            }

            exportToCSV(
                projectsToExport.map(buildAccountsProjectCsvRow),
                `accounts-${activeTab}-projects-${new Date().toISOString().slice(0, 10)}.csv`
            );
            showToast(`${projectsToExport.length} projects exported to CSV.`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export accounts projects.', 'error');
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

    const getPaymentStatusColor = (status?: PaymentStatus) => {
        switch (status) {
            case 'COMPLETED':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'PARTIAL':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'PENDING':
            default:
                return 'bg-red-100 text-red-700 border-red-200';
        }
    };

    const getPaymentStatusIcon = (status?: PaymentStatus) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle size={16} />;
            case 'PARTIAL':
                return <Clock size={16} />;
            case 'PENDING':
            default:
                return <AlertTriangle size={16} />;
        }
    };

    type PaymentAgingLevel = 'GREEN' | 'YELLOW' | 'RED' | 'COMPLETED';

    const getPendingDaysInAccounts = (project: Project): number => {
        if (!project.stageChangeTimestamp) return 0;
        const stageDate = new Date(project.stageChangeTimestamp);
        const now = new Date();
        const diffMs = now.getTime() - stageDate.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return days < 0 ? 0 : days;
    };

    const getPaymentAgingLevel = (project: Project): PaymentAgingLevel => {
        const pendingAmount = project.pendingAmount ?? 0;
        if (pendingAmount <= 0) return 'COMPLETED';
        const days = getPendingDaysInAccounts(project);
        if (days <= 10) return 'GREEN';
        if (days <= 20) return 'YELLOW';
        return 'RED';
    };

    const getPaymentAgingStyle = (level: PaymentAgingLevel) => {
        switch (level) {
            case 'GREEN':
                return {
                    cardClass: 'border-2 border-green-200',
                    badgeClass: 'bg-green-100 text-green-800 border-green-200',
                    label: 'GREEN',
                };
            case 'YELLOW':
                return {
                    cardClass: 'border-2 border-yellow-200',
                    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    label: 'YELLOW',
                };
            case 'RED':
                return {
                    cardClass: 'border-2 border-red-300',
                    badgeClass: 'bg-red-100 text-red-800 border-red-200',
                    label: 'RED',
                };
            default:
                return {
                    cardClass: 'border border-white/50',
                    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
                    label: 'COMPLETED',
                };
        }
    };

    const getInstallationWorkStatusDisplay = (status?: Project['installationStatus']) => {
        switch (status) {
            case 'WORK_DONE':
                return {
                    label: 'Work Done',
                    cardClass: 'bg-emerald-50 border-2 border-emerald-200',
                    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    icon: <CheckCircle className="text-emerald-500 mb-2" size={24} />
                };
            case 'NOT_DONE':
                return {
                    label: 'Not Done',
                    cardClass: 'bg-rose-50 border-2 border-rose-200',
                    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
                    icon: <AlertTriangle className="text-rose-500 mb-2" size={24} />
                };
            default:
                return {
                    label: 'Pending',
                    cardClass: 'bg-amber-50 border-2 border-amber-200',
                    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
                    icon: <Clock className="text-amber-500 mb-2" size={24} />
                };
        }
    };

    const canRequestDeletion = (project: Project) => {
        return (
            activeTab === 'active' &&
            project.currentStage !== 'DROPPED' &&
            project.currentStage !== 'COMPLETED' &&
            project.deletionRequestStatus !== 'PENDING'
        );
    };

    const allProjects = React.useMemo(() => [...tabProjects.active, ...tabProjects.done], [tabProjects]);
    const accountsAttention = React.useMemo(() => {
        let yellowCount = 0;
        let redCount = 0;

        allProjects.forEach((project) => {
            const level = getPaymentAgingLevel(project);
            if (level === 'YELLOW') yellowCount += 1;
            if (level === 'RED') redCount += 1;
        });

        const notes: string[] = [];
        if (yellowCount > 0) {
            notes.push(`${yellowCount} project${yellowCount === 1 ? '' : 's'} in yellow payment aging state.`);
        }
        if (redCount > 0) {
            notes.push(`${redCount} project${redCount === 1 ? '' : 's'} in red payment aging state.`);
        }
        return notes;
    }, [allProjects]);

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />
                
                <div className="px-4 lg:px-12 py-6 lg:py-10 pb-32">
                    <EmbeddedUserDashboard
                        projects={allProjects}
                        userFirstName={user?.name?.split(' ')[0]}
                        alertDetails={accountsAttention}
                        showGreeting
                    />

                    {/* Header */}
                    <div className="mb-8 animate-premium flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">
                                Accounts & Payments
                            </h1>
                            <p className="text-gray-600 text-sm lg:text-base font-medium">
                                Track payments and financial data for projects
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleBulkAccountsExport}
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
                        <div className="glass-panel rounded-2xl p-4 mb-6 animate-premium shadow-lg flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Page {donePage} of {doneTotalPages}</p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => loadProjects('done', true, donePage - 1, completedSearch)}
                                    disabled={loading || donePage <= 1}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadProjects('done', true, donePage + 1, completedSearch)}
                                    disabled={loading || donePage >= doneTotalPages}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-50"
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
                                    {activeTab === 'active' ? 'No active accounts projects.' : 'No completed projects yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredProjects.map((project) => {
                                const isDoneProject = activeTab === 'done' || project.viewBucket === 'DONE';
                                const pendingDaysInAccounts = getPendingDaysInAccounts(project);
                                const paymentAgingLevel = getPaymentAgingLevel(project);
                                const paymentAgingStyle = getPaymentAgingStyle(paymentAgingLevel);
                                const installationWorkStatus = getInstallationWorkStatusDisplay(project.installationStatus);
                                return (
                                <div key={project.id} className={`glass-panel rounded-2xl p-6 lg:p-8 animate-premium hover:shadow-2xl transition-all duration-300 ${isDoneProject ? 'border border-white/50' : paymentAgingStyle.cardClass}`}>
                                    {/* Project Header */}
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                <h3 className="text-xl font-bold text-gray-900">
                                                    {project.school}
                                                </h3>
                                                <ExecutiveInfoHover createdBy={getExecutiveDisplayName(project.createdBy)} zone={project.zone} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                                {(project.contactPerson || project.contactNumber) && (
                                                    <div className="flex items-start sm:items-center gap-4 flex-nowrap w-full sm:w-auto">
                                                        {project.contactPerson && (
                                                            <span className="flex items-start sm:items-center gap-2">
                                                                <User size={16} className="text-gray-400 shrink-0 mt-0.5 sm:mt-0" />
                                                                <span className="font-medium break-words">{project.contactPerson}</span>
                                                            </span>
                                                        )}
                                                        {project.contactNumber && (
                                                            <span className="flex items-center gap-2 shrink-0">
                                                                <Phone size={16} className="text-gray-400 shrink-0" />
                                                                <span className="font-medium shrink-0">{project.contactNumber}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <span className="flex items-start sm:items-center gap-2">
                                                    <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5 sm:mt-0" />
                                                    <span className="font-medium break-words">{project.place}, {project.district}</span>
                                                </span>
                                                {!isDoneProject && (
                                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${paymentAgingStyle.badgeClass}`}>
                                                        <Clock size={14} />
                                                        {paymentAgingStyle.label} - {pendingDaysInAccounts} days
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {activeTab === 'active' && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedProject(project);
                                                        setShowPaymentModal(true);
                                                    }}
                                                    className="p-3 hover:bg-brand-50 rounded-xl transition-all hover:shadow-md text-brand-600 hover:scale-105"
                                                    title="Record Payment Transaction"
                                                >
                                                    <Edit2 size={20} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setSelectedProject(project);
                                                    setShowDetailsModal(true);
                                                }}
                                                className="p-3 hover:bg-gray-100 rounded-xl transition-all hover:shadow-md text-gray-600 hover:scale-105"
                                                title="View Details"
                                            >
                                                <Eye size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => exportAccountsProjectCsv(project)}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 transition-all hover:scale-105 hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-md"
                                                title={`Export ${project.school} to CSV`}
                                                aria-label={`Export ${project.school} to CSV`}
                                            >
                                                <Download size={15} />
                                                <span className="hidden sm:inline">Export CSV</span>
                                            </button>

                                            {canRequestDeletion(project) && (
                                                <button
                                                    onClick={() => handleDeletionRequest(project)}
                                                    className="p-3 hover:bg-red-50 rounded-xl transition-all hover:shadow-md text-red-600 hover:scale-105"
                                                    title="Request Deletion"
                                                >
                                                    <AlertTriangle size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Financial Highlight Blocks */}
                                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
                                        {/* Invoice Amount */}
                                        <div className="relative bg-blue-50 border-2 border-blue-200 rounded-xl p-3 sm:p-4 pt-11 hover:shadow-md transition-all">
                                            {activeTab === 'active' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProject(project);
                                                        setShowInvoiceAmountModal(true);
                                                    }}
                                                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white/90 text-blue-700 shadow-sm transition-all hover:scale-105 hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                    title="Edit invoice amount"
                                                    aria-label={`Edit invoice amount for ${project.school}`}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                            <div className="flex flex-col items-center text-center">
                                                <Receipt className="text-blue-500 mb-2 w-5 h-5 sm:w-6 sm:h-6" />
                                                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Invoice Amount</p>
                                                <p className="text-lg sm:text-2xl font-bold text-blue-700">
                                                    {formatCurrency(project.invoiceAmount)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Amount Received */}
                                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
                                            <div className="flex flex-col items-center text-center">
                                                <CheckCircle className="text-green-500 mb-2 w-5 h-5 sm:w-6 sm:h-6" />
                                                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Amount Received</p>
                                                <p className="text-lg sm:text-2xl font-bold text-green-700">
                                                    {formatCurrency(project.amountReceived)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Pending Amount */}
                                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
                                            <div className="flex flex-col items-center text-center">
                                                <AlertTriangle className="text-red-500 mb-2 w-5 h-5 sm:w-6 sm:h-6" />
                                                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pending Amount</p>
                                                <p className="text-lg sm:text-2xl font-bold text-red-700">
                                                    {formatCurrency(project.pendingAmount)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Payment Status */}
                                        <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
                                            <div className="flex flex-col items-center text-center">
                                                <div className="mb-2 scale-75 sm:scale-100 origin-bottom">
                                                    {getPaymentStatusIcon(project.paymentStatus)}
                                                </div>
                                                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payment Status</p>
                                                <span className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm font-bold rounded-full border-2 shadow-sm ${getPaymentStatusColor(project.paymentStatus)}`}>
                                                    {project.paymentStatus || 'PENDING'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`${installationWorkStatus.cardClass} col-span-2 xl:col-span-1 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all`}>
                                            <div className="flex flex-col items-center text-center">
                                                <div className="scale-75 sm:scale-100 origin-bottom mb-1">
                                                    {installationWorkStatus.icon}
                                                </div>
                                                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Work Status</p>
                                                <span className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm font-bold rounded-full border-2 shadow-sm ${installationWorkStatus.badgeClass}`}>
                                                    {installationWorkStatus.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rich Payment Information Display */}
                                    {(project.paymentDate || project.paymentRemarks || project.paymentProofUrl) && (
                                        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-4 mb-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {project.paymentDate && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-100 rounded-lg">
                                                            <Calendar size={18} className="text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 font-medium">Last Payment</p>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {new Date(project.paymentDate).toLocaleDateString('en-GB', { 
                                                                    day: 'numeric', 
                                                                    month: 'short', 
                                                                    year: 'numeric' 
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                {project.paymentProofUrl && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-green-100 rounded-lg">
                                                            <Link size={18} className="text-green-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 font-medium">Payment Proof</p>
                                                            <a 
                                                                href={project.paymentProofUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-bold text-green-600 hover:text-green-700 underline"
                                                            >
                                                                View Document
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {project.paymentRemarks && (
                                                    <div className="md:col-span-2 lg:col-span-1">
                                                        <p className="text-xs text-gray-500 font-medium mb-1">Latest Remarks</p>
                                                        <p className="text-sm text-gray-700 bg-white/80 px-3 py-2 rounded-lg line-clamp-2">
                                                            {project.paymentRemarks}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stage Badge */}
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200 shadow-sm">
                                            <Building2 size={16} className="hidden sm:block" />
                                            {project.currentStage}
                                        </span>
                                        {project.schoolLocationLink && (
                                            <a
                                                href={project.schoolLocationLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm hover:bg-emerald-100 transition-colors"
                                            >
                                                <MapPin size={16} />
                                                Open Customer Location
                                            </a>
                                        )}
                                        {project.deletionRequestStatus === 'PENDING' && (
                                            <>
                                                <span className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200 shadow-sm">
                                                    Frozen
                                                </span>
                                                <span className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                                                    Pending Deletion Approval
                                                </span>
                                            </>
                                        )}
                                        {!isDoneProject && (
                                            <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full border shadow-sm ${paymentAgingStyle.badgeClass}`}>
                                                <Clock size={16} />
                                                Pending {pendingDaysInAccounts} days
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )})
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Update Modal */}
            {showPaymentModal && selectedProject && (
                <PaymentModal
                    project={selectedProject}
                    onClose={() => {
                        setShowPaymentModal(false);
                        setSelectedProject(null);
                    }}
                    onSubmit={(formData) => handleUpdatePayment(selectedProject.id, formData)}
                />
            )}

            {showInvoiceAmountModal && selectedProject && (
                <InvoiceAmountModal
                    project={selectedProject}
                    onClose={() => {
                        setShowInvoiceAmountModal(false);
                        setSelectedProject(null);
                    }}
                    onSubmit={(formData) => handleUpdateInvoiceAmount(selectedProject.id, formData)}
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

// Payment Modal Component - Transaction-Based Entry
const LegacyPaymentModal: React.FC<{
    project: Project;
    onClose: () => void;
    onSubmit: (data: UpdateAccountsDataRequest) => void;
}> = ({ project, onClose, onSubmit }) => {
    const [invoiceAmount, setInvoiceAmount] = useState<number>(project.invoiceAmount || 0);
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [paymentRemarks, setPaymentRemarks] = useState<string>('');
    const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
    const [errors, setErrors] = useState<string[]>([]);

    const currentTotalReceived = project.amountReceived || 0;
    const currentInvoiceAmount = project.invoiceAmount || 0;
    const currentPending = project.pendingAmount ?? currentInvoiceAmount;
    const invoiceChanged = invoiceAmount !== currentInvoiceAmount;
    const hasPaymentEntry = newPaymentAmount > 0;

    const { totalReceived: newTotalReceived, pending: remainingPending } = paymentPreview(invoiceAmount, currentTotalReceived, newPaymentAmount);
    const willComplete = remainingPending === 0 && hasPaymentEntry;

    // Real-time validation
    React.useEffect(() => {
        const validationErrors: string[] = [];
        
        if (!hasPaymentEntry) {
            validationErrors.push('Enter a payment amount to save');
        }

        if (invoiceAmount <= 0) {
            validationErrors.push('Invoice amount must be set before recording a payment');
        }

        if (invoiceAmount > 0 && currentTotalReceived > invoiceAmount) {
            validationErrors.push(`Invoice amount (₹${invoiceAmount.toLocaleString('en-IN')}) cannot be less than received amount (₹${currentTotalReceived.toLocaleString('en-IN')})`);
        }

        if (paymentDate) {
            const selectedDate = new Date(`${paymentDate}T00:00:00`);
            const today = new Date();
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            if (!Number.isNaN(selectedDate.getTime()) && selectedDate.getTime() > todayDate.getTime()) {
                validationErrors.push('Payment date cannot be in the future');
            }
        }
        
        if (hasPaymentEntry) {
            const effectivePendingBeforePayment = paymentPreview(invoiceAmount, currentTotalReceived).pending;
            if (newPaymentAmount > effectivePendingBeforePayment) {
                validationErrors.push(`Payment amount (₹${newPaymentAmount.toLocaleString('en-IN')}) exceeds pending amount (₹${effectivePendingBeforePayment.toLocaleString('en-IN')})`);
            }
        }
        
        setErrors(validationErrors);
    }, [currentTotalReceived, hasPaymentEntry, invoiceAmount, invoiceChanged, newPaymentAmount, paymentDate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (errors.length > 0) {
            return;
        }

        onSubmit({
            invoiceAmount,
            amountReceived: hasPaymentEntry ? newPaymentAmount : undefined,
            paymentDate: hasPaymentEntry ? paymentDate : undefined,
            paymentRemarks: hasPaymentEntry ? paymentRemarks : undefined,
            paymentProofUrl: hasPaymentEntry ? paymentProofUrl : undefined
        });
    };

    const isValid = errors.length === 0 && (invoiceChanged || hasPaymentEntry);

    return (
        <StandardModuleModal
            title="Update Accounts Details"
            subtitle={project.school}
            icon={<CreditCard size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-3xl"
        >
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Current Financial Status - Enhanced */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Receipt className="text-blue-700" size={20} />
                            <h3 className="text-base font-bold text-blue-900">Current Financial Status</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Invoice Amount</p>
                                <p className="text-xl font-bold text-blue-900">₹{invoiceAmount.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Total Received</p>
                                <p className="text-xl font-bold text-green-700">₹{currentTotalReceived.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Pending</p>
                                <p className="text-xl font-bold text-red-700">₹{currentPending.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Receipt size={18} className="text-brand-600" />
                            Invoice Adjustment
                        </h3>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                <DollarSign size={18} className="text-brand-600" />
                                Invoice Amount (₹) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={invoiceAmount > 0 ? formatIndianNumber(invoiceAmount.toString()) : ''}
                                onChange={(e) => setInvoiceAmount(parseIndianNumber(e.target.value))}
                                className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                placeholder="Enter invoice amount"
                            />
                            <p className="text-xs text-gray-500 mt-1 ml-1">Update the invoice here. Pending amount and payment status will be recalculated on save.</p>
                        </div>
                    </div>

                    {/* New Payment Amount - Enhanced */}
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <CreditCard size={18} className="text-brand-600" />
                            Payment Entry
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                    <DollarSign size={18} className="text-brand-600" />
                                    New Payment Amount (₹)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newPaymentAmount > 0 ? formatIndianNumber(newPaymentAmount.toString()) : ''}
                                        onChange={(e) => setNewPaymentAmount(parseIndianNumber(e.target.value))}
                                        className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                        placeholder="Optional payment amount"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 ml-1">Leave empty if you only want to update the invoice amount.</p>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                    <Calendar size={18} className="text-brand-600" />
                                    Payment Date
                                </label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1 ml-1">Used only when a payment amount is entered.</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Edit2 size={18} className="text-brand-600" />
                            Remarks & Notes
                        </h3>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                <Link size={18} className="text-brand-600" />
                                Payment Proof URL
                            </label>
                            <input
                                type="url"
                                value={paymentProofUrl}
                                onChange={(e) => setPaymentProofUrl(e.target.value)}
                                className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                placeholder="https://drive.google.com/... or screenshot URL"
                            />
                            <p className="text-xs text-gray-500 mt-1 ml-1">Optional - add link to payment receipt/screenshot if available</p>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                <Edit2 size={18} className="text-brand-600" />
                                Payment Remarks
                            </label>
                            <textarea
                                value={paymentRemarks}
                                onChange={(e) => setPaymentRemarks(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                placeholder="Optional notes about this payment transaction..."
                            />
                        </div>
                    </div>

                    {/* Calculated Preview - Enhanced */}
                    {(invoiceChanged || hasPaymentEntry) && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="text-green-700" size={20} />
                                <h3 className="text-base font-bold text-green-900">Preview After Save</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white/80 rounded-lg p-3 text-center">
                                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Updated Invoice</p>
                                    <p className="text-xl font-bold text-green-900">₹{invoiceAmount.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-white/80 rounded-lg p-3 text-center">
                                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">New Total Received</p>
                                    <p className="text-xl font-bold text-green-900">₹{newTotalReceived.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-white/80 rounded-lg p-3 text-center">
                                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Remaining Pending</p>
                                    <p className="text-xl font-bold text-green-900">₹{remainingPending.toLocaleString('en-IN')}</p>
                                </div>
                            </div>
                            {willComplete && (
                                <div className="mt-4 p-4 bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-300 rounded-lg shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <p className="font-bold text-amber-900 mb-1">Auto Transition Notice</p>
                                            <p className="text-sm text-amber-800">Pending will become zero, so the project will follow the existing auto-transition rules when you save.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Validation Errors - Enhanced */}
                    {errors.length > 0 && (
                        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-red-900 mb-2">Please fix the following issues:</p>
                                    <ul className="text-sm text-red-700 space-y-1">
                                        {errors.map((error, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-red-500 mt-0.5">-</span>
                                                <span>{error}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-gray-700 transition-all hover:shadow-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            className={`px-6 py-3 rounded-xl font-bold transition-all ${
                                isValid 
                                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:shadow-xl hover:scale-[1.02] shadow-lg' 
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Save Financial Update
                        </button>
                    </div>
                </form>
        </StandardModuleModal>
    );
};

const PaymentModal: React.FC<{
    project: Project;
    onClose: () => void;
    onSubmit: (data: UpdateAccountsDataRequest) => void;
}> = ({ project, onClose, onSubmit }) => {
    const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [paymentRemarks, setPaymentRemarks] = useState<string>('');
    const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
    const [errors, setErrors] = useState<string[]>([]);

    const currentTotalReceived = project.amountReceived || 0;
    const currentInvoiceAmount = project.invoiceAmount || 0;
    const currentPending = project.pendingAmount ?? currentInvoiceAmount;
    const hasPaymentEntry = newPaymentAmount > 0;
    const { totalReceived: newTotalReceived, pending: remainingPending } = paymentPreview(currentInvoiceAmount, currentTotalReceived, newPaymentAmount);
    const willComplete = remainingPending === 0 && hasPaymentEntry;

    React.useEffect(() => {
        const validationErrors: string[] = [];

        if (!hasPaymentEntry) {
            validationErrors.push('Enter a payment amount to save');
        }

        if (currentInvoiceAmount <= 0) {
            validationErrors.push('Invoice amount must be set before recording a payment');
        }

        if (paymentDate) {
            const selectedDate = new Date(`${paymentDate}T00:00:00`);
            const today = new Date();
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            if (!Number.isNaN(selectedDate.getTime()) && selectedDate.getTime() > todayDate.getTime()) {
                validationErrors.push('Payment date cannot be in the future');
            }
        }

        if (hasPaymentEntry) {
            const effectivePendingBeforePayment = paymentPreview(currentInvoiceAmount, currentTotalReceived).pending;
            if (newPaymentAmount > effectivePendingBeforePayment) {
                validationErrors.push(`Payment amount (₹${newPaymentAmount.toLocaleString('en-IN')}) exceeds pending amount (₹${effectivePendingBeforePayment.toLocaleString('en-IN')})`);
            }
        }

        setErrors(validationErrors);
    }, [currentInvoiceAmount, currentTotalReceived, hasPaymentEntry, newPaymentAmount, paymentDate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (errors.length > 0) {
            return;
        }

        onSubmit({
            amountReceived: newPaymentAmount,
            paymentDate,
            paymentRemarks: paymentRemarks || undefined,
            paymentProofUrl: paymentProofUrl || undefined
        });
    };

    const isValid = errors.length === 0 && hasPaymentEntry;

    return (
        <StandardModuleModal
            title="Record Payment"
            subtitle={project.school}
            icon={<CreditCard size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-3xl"
        >
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Receipt className="text-blue-700" size={20} />
                        <h3 className="text-base font-bold text-blue-900">Current Financial Status</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/80 rounded-lg p-3 text-center">
                            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Invoice Amount</p>
                            <p className="text-xl font-bold text-blue-900">₹{currentInvoiceAmount.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 text-center">
                            <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Total Received</p>
                            <p className="text-xl font-bold text-green-700">₹{currentTotalReceived.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 text-center">
                            <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Pending</p>
                            <p className="text-xl font-bold text-red-700">₹{currentPending.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard size={18} className="text-brand-600" />
                        Payment Entry
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                <DollarSign size={18} className="text-brand-600" />
                                New Payment Amount (₹)
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={newPaymentAmount > 0 ? formatIndianNumber(newPaymentAmount.toString()) : ''}
                                    onChange={(e) => setNewPaymentAmount(parseIndianNumber(e.target.value))}
                                    className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                    placeholder="Enter payment amount"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-1">This entry will be added to payment history and the pending amount will be recalculated.</p>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                <Calendar size={18} className="text-brand-600" />
                                Payment Date
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1 ml-1">Used for this payment history entry.</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Edit2 size={18} className="text-brand-600" />
                        Remarks & Notes
                    </h3>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <Link size={18} className="text-brand-600" />
                            Payment Proof URL
                        </label>
                        <input
                            type="url"
                            value={paymentProofUrl}
                            onChange={(e) => setPaymentProofUrl(e.target.value)}
                            className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                            placeholder="https://drive.google.com/... or screenshot URL"
                        />
                        <p className="text-xs text-gray-500 mt-1 ml-1">Optional - add link to payment receipt/screenshot if available</p>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <Edit2 size={18} className="text-brand-600" />
                            Payment Remarks
                        </label>
                        <textarea
                            value={paymentRemarks}
                            onChange={(e) => setPaymentRemarks(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 text-base font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                            placeholder="Optional notes about this payment transaction..."
                        />
                    </div>
                </div>

                {hasPaymentEntry && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="text-green-700" size={20} />
                            <h3 className="text-base font-bold text-green-900">Preview After Save</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Invoice Amount</p>
                                <p className="text-xl font-bold text-green-900">₹{currentInvoiceAmount.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">New Total Received</p>
                                <p className="text-xl font-bold text-green-900">₹{newTotalReceived.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Remaining Pending</p>
                                <p className="text-xl font-bold text-green-900">₹{remainingPending.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                        {willComplete && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-300 rounded-lg shadow-sm">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <p className="font-bold text-amber-900 mb-1">Auto Transition Notice</p>
                                        <p className="text-sm text-amber-800">Pending will become zero, so the project will follow the existing auto-transition rules when you save.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-red-900 mb-2">Please fix the following issues:</p>
                                <ul className="text-sm text-red-700 space-y-1">
                                    {errors.map((error, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-red-500 mt-0.5">-</span>
                                            <span>{error}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-gray-700 transition-all hover:shadow-md"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${
                            isValid
                                ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:shadow-xl hover:scale-[1.02] shadow-lg'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        Save Payment
                    </button>
                </div>
            </form>
        </StandardModuleModal>
    );
};

const InvoiceAmountModal: React.FC<{
    project: Project;
    onClose: () => void;
    onSubmit: (data: UpdateAccountsDataRequest) => void;
}> = ({ project, onClose, onSubmit }) => {
    const currentInvoiceAmount = project.invoiceAmount || 0;
    const currentTotalReceived = project.amountReceived || 0;
    const currentPending = project.pendingAmount ?? paymentPreview(currentInvoiceAmount, currentTotalReceived).pending;
    const [invoiceAmount, setInvoiceAmount] = useState<number>(currentInvoiceAmount);
    const [errors, setErrors] = useState<string[]>([]);

    const invoiceChanged = invoiceAmount !== currentInvoiceAmount;
    const updatedPending = paymentPreview(invoiceAmount, currentTotalReceived).pending;

    React.useEffect(() => {
        const validationErrors: string[] = [];

        if (invoiceAmount <= 0) {
            validationErrors.push('Invoice amount must be greater than zero');
        }

        if (!invoiceChanged) {
            validationErrors.push('Change the invoice amount to save');
        }

        if (invoiceAmount > 0 && currentTotalReceived > invoiceAmount) {
            validationErrors.push(`Invoice amount (₹${invoiceAmount.toLocaleString('en-IN')}) cannot be less than received amount (₹${currentTotalReceived.toLocaleString('en-IN')})`);
        }

        setErrors(validationErrors);
    }, [currentInvoiceAmount, currentTotalReceived, invoiceAmount, invoiceChanged]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (errors.length > 0) {
            return;
        }

        onSubmit({ invoiceAmount });
    };

    const isValid = errors.length === 0 && invoiceChanged;

    return (
        <StandardModuleModal
            title="Edit Invoice Amount"
            subtitle={project.school}
            icon={<Receipt size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Receipt className="text-blue-700" size={20} />
                        <h3 className="text-base font-bold text-blue-900">Invoice Snapshot</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/80 rounded-lg p-3 text-center">
                            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Current Invoice</p>
                            <p className="text-xl font-bold text-blue-900">₹{currentInvoiceAmount.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 text-center">
                            <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Received</p>
                            <p className="text-xl font-bold text-green-700">₹{currentTotalReceived.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 text-center">
                            <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Pending</p>
                            <p className="text-xl font-bold text-red-700">₹{currentPending.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 space-y-4">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Edit2 size={18} className="text-brand-600" />
                        Update Invoice Amount
                    </h3>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <DollarSign size={18} className="text-brand-600" />
                            Invoice Amount (₹)
                        </label>
                        <input
                            type="text"
                            value={invoiceAmount > 0 ? formatIndianNumber(invoiceAmount.toString()) : ''}
                            onChange={(e) => setInvoiceAmount(parseIndianNumber(e.target.value))}
                            className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                            placeholder="Enter invoice amount"
                        />
                        <p className="text-xs text-gray-500 mt-1 ml-1">This change will be logged in the project audit trail and pending amount will be recalculated.</p>
                    </div>
                </div>

                {invoiceChanged && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="text-green-700" size={20} />
                            <h3 className="text-base font-bold text-green-900">Preview After Save</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Updated Invoice</p>
                                <p className="text-xl font-bold text-green-900">₹{invoiceAmount.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Received</p>
                                <p className="text-xl font-bold text-green-900">₹{currentTotalReceived.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3 text-center">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">New Pending</p>
                                <p className="text-xl font-bold text-green-900">₹{updatedPending.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-red-900 mb-2">Please fix the following issues:</p>
                                <ul className="text-sm text-red-700 space-y-1">
                                    {errors.map((error, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-red-500 mt-0.5">-</span>
                                            <span>{error}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-gray-700 transition-all hover:shadow-md"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${
                            isValid
                                ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:shadow-xl hover:scale-[1.02] shadow-lg'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        Save Invoice Amount
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
    return (
        <StandardModuleModal
            title="Project Financial Details"
            subtitle={project.school}
            icon={<Eye size={22} />}
            onClose={onClose}
            maxWidthClassName="max-w-4xl"
        >
                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-5">
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Building2 size={18} className="text-indigo-600" />
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/80 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Customer</p>
                                <p className="font-bold text-gray-900">{project.school}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current Stage</p>
                                <p className="font-bold text-gray-900">{project.currentStage}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Place</p>
                                <p className="font-bold text-gray-900">{project.place || 'N/A'}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">District</p>
                                <p className="font-bold text-gray-900">{project.district || 'N/A'}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Extra Work Needed</p>
                                <p className="font-bold text-gray-900">{project.isExtraWorkNeeded ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="bg-white/80 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Value</p>
                                <p className="font-bold text-gray-900">
                                    {project.projectValue ? `₹${project.projectValue.toLocaleString('en-IN')}` : 'Not set'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary - Color Coded */}
                    <div>
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <DollarSign size={18} className="text-indigo-600" />
                            Financial Summary
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 p-4 rounded-xl text-center hover:shadow-md transition-all">
                                <Receipt className="mx-auto text-blue-600 mb-2" size={24} />
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Invoice Amount</p>
                                <p className="text-2xl font-bold text-blue-900">₹{project.invoiceAmount?.toLocaleString('en-IN') || '0'}</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 p-4 rounded-xl text-center hover:shadow-md transition-all">
                                <CheckCircle className="mx-auto text-green-600 mb-2" size={24} />
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total Received</p>
                                <p className="text-2xl font-bold text-green-900">₹{project.amountReceived?.toLocaleString('en-IN') || '0'}</p>
                            </div>
                            <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 p-4 rounded-xl text-center hover:shadow-md transition-all">
                                <AlertTriangle className="mx-auto text-red-600 mb-2" size={24} />
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pending Amount</p>
                                <p className="text-2xl font-bold text-red-900">₹{project.pendingAmount?.toLocaleString('en-IN') || '0'}</p>
                            </div>
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 p-4 rounded-xl text-center hover:shadow-md transition-all">
                                <Clock className="mx-auto text-gray-600 mb-2" size={24} />
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payment Status</p>
                                <p className="text-lg font-bold text-gray-900">{project.paymentStatus || 'PENDING'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Receipt size={18} className="text-green-600" />
                            Payment Information
                        </h3>
                        <div className="space-y-4">
                            {project.paymentDate && (
                                <div className="bg-white/80 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Payment Date</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={16} className="text-green-600" />
                                        <p className="font-bold text-gray-900">
                                            {new Date(project.paymentDate).toLocaleDateString('en-GB', { 
                                                weekday: 'long',
                                                day: 'numeric', 
                                                month: 'long', 
                                                year: 'numeric' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {project.paymentRemarks && (
                                <div className="bg-white/80 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Latest Payment Remarks</p>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{project.paymentRemarks}</p>
                                </div>
                            )}
                            
                            {project.paymentProofUrl && (
                                <div className="bg-white/80 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Payment Proof</p>
                                    <a 
                                        href={project.paymentProofUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm font-bold text-green-600 hover:text-green-700 bg-green-50 px-4 py-2 rounded-lg hover:shadow-md transition-all"
                                    >
                                        <Link size={16} />
                                        View Payment Proof Document
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            )}

                            {project.accountsUpdatedTimestamp && (
                                <div className="bg-white/80 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Updated</p>
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-600" />
                                        <p className="text-sm font-semibold text-gray-700">
                                            {new Date(project.accountsUpdatedTimestamp).toLocaleString('en-IN', {
                                                weekday: 'short',
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sales Information */}
                    {project.projectValue && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5">
                            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign size={18} className="text-purple-600" />
                                Sales Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/80 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project Value</p>
                                    <p className="text-xl font-bold text-purple-900">₹{project.projectValue?.toLocaleString('en-IN')}</p>
                                </div>
                                {project.salesRemarks && (
                                    <div className="bg-white/80 rounded-lg p-3">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sales Remarks</p>
                                        <p className="text-sm text-gray-700">{project.salesRemarks}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-3 border-t border-gray-200">
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

