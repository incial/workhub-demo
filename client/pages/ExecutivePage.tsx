import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useZone } from '../context/ZoneContext';
import { Tabs } from '../components/ui/Tabs';
import { Project, CreateProjectRequest, UpdateExecutiveAdditionalDataRequest, ProjectStage, ExecutiveProjectStatus, FirstMeetingOutcome, ProjectCreationLimitStatus, SchoolVisit, User as AppUser, Zone as ProjectZone, ExecutiveProjectCategory, EnquiryType, NeedHelp, SalesOfficeRemark } from '../types';
import { projectApi, schoolVisitApi, usersApi } from '../services/api';
import { Plus, Search, Building2, MapPin, Calendar, AlertTriangle, Edit2, Eye, ChevronDown, User, Phone, FileText, Briefcase, Check, X, Info, Wallet, BadgeCheck, ArrowRight } from 'lucide-react';
import { KERALA_DISTRICTS } from '../constants/kerala-districts';
import { formatIndianNumber } from '../utils/numberFormat';
import { ProjectDeletionRequestModal } from '../components/ui/ProjectDeletionRequestModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { PARENT_COMPANY_OPTIONS } from '../constants/dropdown-options';
import { EmbeddedUserDashboard } from '../components/dashboard/EmbeddedUserDashboard';

const calculateNextContactStatus = (nextContact?: string) => {
    if (!nextContact) return null;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const due = new Date(`${nextContact}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.ceil((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        return {
            label: 'Should Visit Today',
            shortLabel: 'Visit Today',
            className: 'text-emerald-800 bg-emerald-100 border-emerald-300',
            bannerClassName: 'border-emerald-300 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20',
            priority: 0,
            diffDays,
            isToday: true
        };
    }
    if (diffDays < 0) {
        return {
            label: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`,
            shortLabel: 'Overdue',
            className: 'text-red-700 bg-red-100 border-red-200',
            bannerClassName: 'border-red-200 bg-red-50 text-red-700',
            priority: 1,
            diffDays,
            isToday: false
        };
    }
    return {
        label: `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`,
        shortLabel: `${diffDays}d Left`,
        className: 'text-green-700 bg-green-100 border-green-200',
        bannerClassName: 'border-green-200 bg-green-50 text-green-700',
        priority: 2,
        diffDays,
        isToday: false
    };
};

const getNextContactSortRank = (project: Project) => {
    const status = calculateNextContactStatus(project.nextContact);
    if (!status) {
        return { priority: 3, diffDays: Number.MAX_SAFE_INTEGER };
    }
    return { priority: status.priority, diffDays: status.diffDays };
};

const parentCompanySelectOptions = PARENT_COMPANY_OPTIONS.map((company) => ({
    label: company,
    value: company
}));

const parseParentCompanies = (value?: string) =>
    (value || '')
        .split(',')
        .map((company) => company.trim())
        .filter((company, index, list): company is (typeof PARENT_COMPANY_OPTIONS)[number] =>
            company.length > 0
            && list.indexOf(company) === index
            && (PARENT_COMPANY_OPTIONS as readonly string[]).includes(company)
        );

const serializeParentCompanies = (companies: string[]) => companies.join(', ');

const EXECUTIVE_CATEGORY_OPTIONS: Array<{ label: string; value: ExecutiveProjectCategory }> = [
    { label: 'Star', value: 'STAR' },
    { label: 'Common', value: 'COMMON' },
    { label: 'Art and Crafts', value: 'ART_AND_CRAFTS' },
    { label: 'Systematics', value: 'SYSTEMATICS' }
];

const ENQUIRY_OPTIONS: Array<{ label: string; value: EnquiryType }> = [
    { label: 'Outdoor', value: 'OUTDOOR' },
    { label: 'Indoor', value: 'INDOOR' },
    { label: 'Furniture', value: 'FURNITURE' },
    { label: 'Lab Art Work', value: 'LAB_ART_WORK' },
    { label: 'No Enquiries', value: 'NO_ENQUIRIES' }
];

const NEED_HELP_OPTIONS: Array<{ label: string; value: NeedHelp }> = [
    { label: 'No Need', value: 'NO_NEED' },
    { label: 'Sales Office', value: 'SALES_OFFICE' },
    { label: 'Sales Head', value: 'SALES_HEAD' },
    { label: 'Management', value: 'MANAGEMENT' },
    { label: 'Other Departments', value: 'OTHER_DEPARTMENTS' }
];

const SALES_OFFICE_REMARK_OPTIONS: Array<{ label: string; value: SalesOfficeRemark }> = [
    { label: 'Informed to SM', value: 'INFORMED_TO_SM' },
    { label: 'Informed to OPRN DEP', value: 'INFORMED_TO_OPRN_DEP' },
    { label: 'Informed to COO', value: 'INFORMED_TO_COO' },
    { label: 'Informed to MD', value: 'INFORMED_TO_MD' },
    { label: 'Given Estimation', value: 'GIVEN_ESTIMATION' },
    { label: 'Work Order Received', value: 'WORK_ORDER_RECEIVED' },
    { label: 'Delivery Completed', value: 'DELIVERY_COMPLETED' },
    { label: 'Installation Completed', value: 'INSTALLATION_COMPLETED' }
];

const EXECUTIVE_ADDITIONAL_DATA_LABELS: Record<string, string> = Object.fromEntries([
    ...EXECUTIVE_CATEGORY_OPTIONS,
    ...ENQUIRY_OPTIONS,
    ...NEED_HELP_OPTIONS,
    ...SALES_OFFICE_REMARK_OPTIONS
].map((option) => [option.value, option.label]));

const formatExecutiveAdditionalDataValue = (value?: string) =>
    value ? EXECUTIVE_ADDITIONAL_DATA_LABELS[value] || value : 'Not set';

const formatOptionalDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

const formatCurrency = (value?: number) => `₹${formatIndianNumber(value ?? 0)}`;

const normalizeParentCompany = (value?: string) => serializeParentCompanies(parseParentCompanies(value));

const ADMIN_PROJECT_ZONE_OPTIONS: Array<{ label: string; value: ProjectZone;}> = [
    { label: 'Zone 1', value: 'ZONE_1'  },
    { label: 'Zone 2', value: 'ZONE_2'  },
    { label: 'Zone 3', value: 'ZONE_3'}
];

const NAME_WITH_COMMON_PUNCTUATION_REGEX = /^[\p{L}\s.'-]*$/u;
const PLACE_WITH_COMMON_PUNCTUATION_REGEX = /^[\p{L}\s.'-]*$/u;

const sanitizeNameInput = (value: string) => value.replace(/[^\p{L}\s.'-]/gu, '');
const sanitizePlaceInput = (value: string) => value.replace(/[^\p{L}\s.'-]/gu, '');
const parseOptionalIndianNumberInput = (value: string): number | undefined => {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) {
        return undefined;
    }

    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
};

const getTodayDateInputValue = () => new Date().toISOString().split('T')[0];

const getTomorrowDateInputValue = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
};

const isFutureDateValue = (value?: string) => {
    if (!value) return false;
    const selectedDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) return false;
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return selectedDate.getTime() > todayDate.getTime();
};

const isPastDateValue = (value?: string) => {
    if (!value) return false;
    const selectedDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) return false;
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return selectedDate.getTime() < todayDate.getTime();
};

const isTodayOrPastDateValue = (value?: string) => {
    if (!value) return false;
    const selectedDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) return false;
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return selectedDate.getTime() <= todayDate.getTime();
};

const validateExecutiveProjectForm = (
    formData: CreateProjectRequest,
    options?: { allowTodayForNextContact?: boolean }
) => {
    const normalizedContactPerson = (formData.contactPerson || '').trim();
    const normalizedPlace = (formData.place || '').trim();
    const allowTodayForNextContact = Boolean(options?.allowTodayForNextContact);

    if (normalizedContactPerson && !NAME_WITH_COMMON_PUNCTUATION_REGEX.test(normalizedContactPerson)) {
        return 'Contact person name can include letters, spaces, dots, apostrophes, and hyphens only.';
    }

    if (normalizedPlace && !PLACE_WITH_COMMON_PUNCTUATION_REGEX.test(normalizedPlace)) {
        return 'Place name can include letters, spaces, dots, apostrophes, and hyphens only.';
    }

    if (isFutureDateValue(formData.lastContact)) {
        return 'Last contact date cannot be in the future.';
    }

    if (formData.nextContact && (allowTodayForNextContact ? isPastDateValue(formData.nextContact) : isTodayOrPastDateValue(formData.nextContact))) {
        return 'Next contact date must be a future date.';
    }

    return null;
};

const getExecutiveOnboardingMissingFields = (project: Project) => {
    const missingFields: string[] = [];

    if (!project.school?.trim()) missingFields.push('Customer Name');
    if (!project.projectName?.trim()) missingFields.push('Project Name');
    if (!project.contactPerson?.trim()) missingFields.push('Contact Person');
    if (!project.contactNumber?.trim()) missingFields.push('Contact Number');
    if (!project.place?.trim()) missingFields.push('Place');
    if (!project.district?.trim()) missingFields.push('District');
    if (!project.parentCompany?.trim()) missingFields.push('Parent Company');
    if (project.projectValue == null || project.projectValue <= 0) missingFields.push('Project Value');
    if (!project.firstMeetingOutcome) missingFields.push('First Meeting Feedback');

    return missingFields;
};

const getExecutiveOnboardingRequirementsMessage = (project?: Project) => {
    const missingFields = project ? getExecutiveOnboardingMissingFields(project) : [];
    if (missingFields.length > 0) {
        return `Before moving this project to onboarded, add: ${missingFields.join(', ')}.`;
    }

    return 'Before moving this project to onboarded, add all mandatory fields: Customer Name, Project Name, Contact Person, Contact Number, Place, District, Parent Company, Project Value, and First Meeting Feedback.';
};

const formatZoneLabel = (zone?: string) => {
    if (!zone) return 'N/A';
    return zone.replace(/_/g, ' ');
};

const ExecutiveInfoHover: React.FC<{ executiveName?: string; zone?: string }> = ({ executiveName, zone }) => {
    if (!executiveName && !zone) return null;
    return (
        <div className="inline-flex items-center gap-3">
            <span className="hidden sm:inline text-slate-300 font-light">|</span>
            <div className="flex flex-wrap items-center gap-2">
                {executiveName && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-50/50 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                        <User size={12} className="text-blue-500" />
                        {executiveName}
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

const FormSectionCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}> = ({ icon, title, description, children }) => (
    <section className="rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-white to-brand-50/40 p-5 shadow-[0_18px_45px_-30px_rgba(37,99,235,0.45)] sm:p-6">
        <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 shadow-sm">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-gray-800">{title}</h3>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
        </div>
        {children}
    </section>
);

const FormFieldLabel: React.FC<{
    title: string;
    required?: boolean;
    hint?: string;
}> = ({ title, required, hint }) => (
    <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-bold text-gray-700">
            {title} {required ? <span className="text-red-500">*</span> : null}
        </label>
        {hint ? <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{hint}</span> : null}
    </div>
);

export const ExecutivePage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { effectiveZone, isAdmin, canSwitchZone } = useZone();
    const { showToast } = useToast();
    const { isSidebarCollapsed, showSidebar } = useLayout();
    type ExecutiveTab = 'non-onboarded' | 'onboarded' | 'completed';
    const [tabProjects, setTabProjects] = useState<Record<ExecutiveTab, Project[]>>({
        'non-onboarded': [],
        'onboarded': [],
        'completed': []
    });
    const [tabLoading, setTabLoading] = useState<Record<ExecutiveTab, boolean>>({
        'non-onboarded': false,
        'onboarded': false,
        'completed': false
    });
    const [tabLoaded, setTabLoaded] = useState<Record<ExecutiveTab, boolean>>({
        'non-onboarded': false,
        'onboarded': false,
        'completed': false
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [additionalDataProject, setAdditionalDataProject] = useState<Project | null>(null);
    const [projectForDeletion, setProjectForDeletion] = useState<Project | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [activeTab, setActiveTab] = useState<ExecutiveTab>('non-onboarded');
    const [tabCounts, setTabCounts] = useState<Record<ExecutiveTab, number>>({
        'non-onboarded': 0,
        'onboarded': 0,
        'completed': 0
    });
    const [tabPages, setTabPages] = useState<Record<ExecutiveTab, number>>({
        'non-onboarded': 1,
        onboarded: 1,
        completed: 1
    });
    const [tabTotalPages, setTabTotalPages] = useState<Record<ExecutiveTab, number>>({
        'non-onboarded': 1,
        onboarded: 1,
        completed: 1
    });
    const [appliedTabSearches, setAppliedTabSearches] = useState<Record<ExecutiveTab, string>>({
        'non-onboarded': '',
        onboarded: '',
        completed: ''
    });
    const [transitioningProjectIds, setTransitioningProjectIds] = useState<Set<number>>(new Set());
    const [projectCreationLimitStatus, setProjectCreationLimitStatus] = useState<ProjectCreationLimitStatus | null>(null);
    const [executiveNamesByEmail, setExecutiveNamesByEmail] = useState<Record<string, string>>({});
    const [executiveDirectory, setExecutiveDirectory] = useState<AppUser[]>([]);
    const [visitProject, setVisitProject] = useState<Project | null>(null);
    const transitionInFlightRef = useRef<Set<number>>(new Set());
    const tabLoadingRef = useRef<Record<ExecutiveTab, boolean>>({
        'non-onboarded': false,
        'onboarded': false,
        'completed': false
    });
    const tabLoadedRef = useRef<Record<ExecutiveTab, boolean>>({
        'non-onboarded': false,
        'onboarded': false,
        'completed': false
    });
    const tabFailedRef = useRef<Record<ExecutiveTab, boolean>>({
        'non-onboarded': false,
        'onboarded': false,
        'completed': false
    });
    const loading = tabLoading[activeTab];
    const projects = tabProjects[activeTab];
    const pageSize = 10;
    const selectedExecutiveId = React.useMemo(() => {
        const value = Number(new URLSearchParams(location.search).get('executiveId'));
        return Number.isSafeInteger(value) && value > 0 ? value : undefined;
    }, [location.search]);
    const isVirtualExecutiveView = isAdmin && selectedExecutiveId !== undefined;
    const selectedExecutive = React.useMemo(
        () => executiveDirectory.find((executive) => executive.id === selectedExecutiveId),
        [executiveDirectory, selectedExecutiveId]
    );

    useEffect(() => {
        if (!isVirtualExecutiveView) return;
        setShowCreateModal(false);
        setSelectedProject(null);
        setEditingProject(null);
        setAdditionalDataProject(null);
        setProjectForDeletion(null);
    }, [isVirtualExecutiveView, selectedExecutiveId]);
    const allProjects = React.useMemo(() => {
        const merged = new Map<number, Project>();
        (Object.values(tabProjects) as Project[][]).flat().forEach((project) => {
            merged.set(project.id, project);
        });
        return Array.from(merged.values());
    }, [tabProjects]);

    useEffect(() => {
        if (!allProjects.length) return;

        const params = new URLSearchParams(location.search);
        const projectIdParam = params.get('projectId');
        const mode = params.get('mode');
        if (!projectIdParam) return;

        const projectId = Number(projectIdParam);
        if (Number.isNaN(projectId)) return;

        const project = allProjects.find(p => p.id === projectId);
        if (!project) return;

        if (mode === 'edit' && canEdit(project)) {
            setEditingProject(project);
        } else {
            setSelectedProject(project);
        }
        navigate('/projects', { replace: true });
    }, [allProjects, location.search, navigate]);

    const loadProjects = React.useCallback(async (tab: ExecutiveTab, force = false, targetPage = 1, targetSearch = '') => {
        if (tabLoadingRef.current[tab] || ((tabLoadedRef.current[tab] || tabFailedRef.current[tab]) && !force)) return;
        const statusByTab: Record<ExecutiveTab, 'NON_ONBOARDED' | 'ONBOARDED_ACTIVE' | 'COMPLETED'> = {
            'non-onboarded': 'NON_ONBOARDED',
            'onboarded': 'ONBOARDED_ACTIVE',
            'completed': 'COMPLETED'
        };
        try {
            if (force) {
                tabFailedRef.current = { ...tabFailedRef.current, [tab]: false };
            }
            tabLoadingRef.current = { ...tabLoadingRef.current, [tab]: true };
            setTabLoading((prev) => ({ ...prev, [tab]: true }));
            const executiveViewId = isVirtualExecutiveView ? selectedExecutiveId : undefined;
            const projectZone = executiveViewId ? undefined : effectiveZone;
            if (tab === 'completed' && !executiveViewId) {
                const pageData = await projectApi.getDashboardCompletedProjectsPaged('EXECUTIVE', effectiveZone, targetSearch, targetPage, pageSize);
                const normalizedData = (pageData.content || []).filter((p) => p.currentStage !== 'DROPPED');
                setTabProjects((prev) => ({ ...prev, completed: normalizedData }));
                setTabCounts((prev) => ({ ...prev, completed: pageData.totalElements || 0 }));
                setTabPages((prev) => ({ ...prev, completed: (pageData.number ?? 0) + 1 }));
                setTabTotalPages((prev) => ({ ...prev, completed: Math.max(pageData.totalPages || 0, 1) }));
            } else {
                const pageData = await projectApi.getExecutiveProjectsPaged(
                    projectZone,
                    [statusByTab[tab]],
                    targetSearch,
                    targetPage,
                    pageSize,
                    executiveViewId
                );
                setTabProjects((prev) => ({ ...prev, [tab]: pageData.content || [] }));
                setTabCounts((prev) => ({ ...prev, [tab]: pageData.totalElements || 0 }));
                setTabPages((prev) => ({ ...prev, [tab]: (pageData.number ?? 0) + 1 }));
                setTabTotalPages((prev) => ({ ...prev, [tab]: Math.max(pageData.totalPages || 0, 1) }));
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
    }, [effectiveZone, isVirtualExecutiveView, pageSize, selectedExecutiveId, showToast]);

    const loadBadgeCounts = React.useCallback(async () => {
        try {
            if (isVirtualExecutiveView && selectedExecutiveId) {
                const statuses: ExecutiveProjectStatus[] = ['NON_ONBOARDED', 'ONBOARDED_ACTIVE', 'COMPLETED'];
                const pages = await Promise.all(
                    statuses.map((status) => projectApi.getExecutiveProjectsPaged(undefined, [status], '', 1, 1, selectedExecutiveId))
                );
                setTabCounts({
                    'non-onboarded': pages[0].totalElements || 0,
                    onboarded: pages[1].totalElements || 0,
                    completed: pages[2].totalElements || 0
                });
                return;
            }
            const counts = await projectApi.getDashboardBadgeCounts('EXECUTIVE', effectiveZone);
            setTabCounts((prev) => ({
                ...prev,
                onboarded: counts.onboardedCount || 0,
                completed: counts.completedCount || 0
            }));
        } catch (error: any) {
            showToast(error.message || 'Failed to load executive counts', 'error');
        }
    }, [effectiveZone, isVirtualExecutiveView, selectedExecutiveId, showToast]);

    const loadProjectCreationLimitStatus = React.useCallback(async () => {
        try {
            const status = await projectApi.getProjectCreationLimitStatus();
            setProjectCreationLimitStatus(status);
            if (status.creationBlocked && showCreateModal) {
                setShowCreateModal(false);
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to load project creation status', 'error');
        }
    }, [showCreateModal, showToast]);

    const loadExecutiveDirectory = React.useCallback(async () => {
        const canReadFullDirectory = isAdmin
            || user?.role === 'ROLE_SUPER_ADMIN'
            || user?.role === 'ROLE_OPERATOR';
        if (!canReadFullDirectory) {
            const email = user?.email?.trim().toLowerCase();
            const name = user?.name?.trim();
            setExecutiveNamesByEmail(email && name ? { [email]: name } : {});
            setExecutiveDirectory([]);
            return;
        }
        try {
            const users = await usersApi.getAll();
            const nextMap = users.reduce<Record<string, string>>((acc, member) => {
                const email = member.email?.trim().toLowerCase();
                const name = member.name?.trim();
                if (email && name) {
                    acc[email] = name;
                }
                return acc;
            }, {});
            setExecutiveNamesByEmail(nextMap);
            setExecutiveDirectory(
                users
                    .filter((member) => member.role === 'ROLE_EXECUTIVE')
                    .sort((left, right) => left.name.localeCompare(right.name))
            );
        } catch {
            setExecutiveNamesByEmail({});
            setExecutiveDirectory([]);
        }
    }, [isAdmin, user?.email, user?.name, user?.role]);

    const getExecutiveDisplayName = React.useCallback((createdBy?: string) => {
        if (!createdBy) return undefined;
        const normalized = createdBy.trim().toLowerCase();
        return executiveNamesByEmail[normalized] || createdBy;
    }, [executiveNamesByEmail]);

    useEffect(() => {
        setActiveTab('non-onboarded');
        setTabProjects({
            'non-onboarded': [],
            'onboarded': [],
            'completed': []
        });
        setTabLoading({
            'non-onboarded': false,
            'onboarded': false,
            'completed': false
        });
        setTabLoaded({
            'non-onboarded': false,
            'onboarded': false,
            'completed': false
        });
        setSearchInput('');
        setTabCounts({
            'non-onboarded': 0,
            'onboarded': 0,
            'completed': 0
        });
        setTabPages({
            'non-onboarded': 1,
            onboarded: 1,
            completed: 1
        });
        setTabTotalPages({
            'non-onboarded': 1,
            onboarded: 1,
            completed: 1
        });
        setAppliedTabSearches({
            'non-onboarded': '',
            onboarded: '',
            completed: ''
        });
        tabLoadingRef.current = {
            'non-onboarded': false,
            'onboarded': false,
            'completed': false
        };
        tabLoadedRef.current = {
            'non-onboarded': false,
            'onboarded': false,
            'completed': false
        };
        tabFailedRef.current = {
            'non-onboarded': false,
            'onboarded': false,
            'completed': false
        };
        void loadBadgeCounts();
        void loadProjectCreationLimitStatus();
        void loadExecutiveDirectory();
        void loadProjects('non-onboarded');
    }, [effectiveZone, isAdmin, loadBadgeCounts, loadExecutiveDirectory, loadProjectCreationLimitStatus, loadProjects]);

    const isCurrentTabFailed = tabFailedRef.current[activeTab];

    useEffect(() => {
        if (!tabLoaded[activeTab] && !tabLoading[activeTab] && !isCurrentTabFailed) {
            loadProjects(activeTab);
        }
    }, [activeTab, isCurrentTabFailed, loadProjects, tabLoaded, tabLoading]);

    const refreshLoadedTabs = () => {
        (Object.entries(tabLoaded) as Array<[ExecutiveTab, boolean]>).forEach(([tab, loaded]) => {
            if (loaded) {
                loadProjects(tab, true, tabPages[tab], appliedTabSearches[tab]);
            }
        });
    };

    const restoreScrollPosition = (scrollY: number) => {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
    };

    const getExecutiveTabFromProject = (project: Project): ExecutiveTab => {
        if (project.executiveViewStatus === 'COMPLETED' || project.currentStage === 'COMPLETED') {
            return 'completed';
        }
        if (
            project.executiveViewStatus === 'NON_ONBOARDED'
            || ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW'].includes(project.currentStage)
        ) {
            return 'non-onboarded';
        }
        return 'onboarded';
    };

    const reconcileExecutiveProject = (updated: Project) => {
        const targetTab = getExecutiveTabFromProject(updated);
        setTabProjects((prev) => {
            const withoutProject = {
                'non-onboarded': prev['non-onboarded'].filter((p) => p.id !== updated.id),
                onboarded: prev.onboarded.filter((p) => p.id !== updated.id),
                completed: prev.completed.filter((p) => p.id !== updated.id)
            };

            return {
                ...withoutProject,
                [targetTab]: [updated, ...withoutProject[targetTab]]
            };
        });
    };

    const handleCreateProject = async (formData: CreateProjectRequest) => {
        try {
            await projectApi.createProject(formData);
            showToast('Project created successfully', 'success');
            setShowCreateModal(false);
            await loadProjectCreationLimitStatus();
            refreshLoadedTabs();
        } catch (error: any) {
            await loadProjectCreationLimitStatus();
            showToast(error.message || 'Failed to create project', 'error');
        }
    };

    const handleUpdateProject = async (id: number, formData: CreateProjectRequest) => {
        try {
            await projectApi.updateProject(id, formData);
            showToast('Project updated successfully', 'success');
            setEditingProject(null);
            setSelectedProject(null);
            refreshLoadedTabs();
        } catch (error: any) {
            showToast(error.message || 'Failed to update project', 'error');
        }
    };

    const handleUpdateExecutiveAdditionalData = async (id: number, formData: UpdateExecutiveAdditionalDataRequest) => {
        try {
            const updated = await projectApi.updateExecutiveAdditionalData(id, formData);
            reconcileExecutiveProject(updated);
            showToast('Additional project data saved successfully', 'success');
            setAdditionalDataProject(null);
            setSelectedProject(null);
            refreshLoadedTabs();
        } catch (error: any) {
            showToast(error.message || 'Failed to save additional project data', 'error');
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
            setSelectedProject(null);
            refreshLoadedTabs();
        } catch (error: any) {
            showToast(error.message || 'Failed to submit deletion request', 'error');
        }
    };

    const proceedStageTransition = async (project: Project, toStage: ProjectStage) => {
        if (transitionInFlightRef.current.has(project.id)) {
            return;
        }

        if (toStage === 'ONBOARDED') {
            const missingFields = getExecutiveOnboardingMissingFields(project);
            if (missingFields.length > 0) {
                showToast(`Before moving this project to onboarded, add: ${missingFields.join(', ')}.`, 'error');
                return;
            }
        }

        const scrollY = window.scrollY;
        transitionInFlightRef.current.add(project.id);
        setTransitioningProjectIds(prev => new Set(prev).add(project.id));
        try {
            const updated = await projectApi.transitionStage(project.id, { toStage });
            reconcileExecutiveProject(updated);
            showToast('Stage updated successfully', 'success');
            refreshLoadedTabs();
        } catch (error: any) {
            const serverMessage = typeof error?.message === 'string' ? error.message.trim() : '';
            const shouldShowMandatoryFields =
                !serverMessage
                || /^request failed/i.test(serverMessage)
                || /^bad request$/i.test(serverMessage)
                || /^\d{3}$/.test(serverMessage)
                || serverMessage === 'One or more mandatory fields must be entered before moving to the next stage.'
                || serverMessage === 'Before moving this project to onboarded, add all mandatory fields: Customer Name, Project Name, Contact Person, Contact Number, Place, District, Parent Company, Project Value, and First Meeting Feedback.';

            if (shouldShowMandatoryFields) {
                showToast(getExecutiveOnboardingRequirementsMessage(project), 'error');
                return;
            }

            showToast(serverMessage, 'error');
        } finally {
            transitionInFlightRef.current.delete(project.id);
            setTransitioningProjectIds(prev => {
                const next = new Set(prev);
                next.delete(project.id);
                return next;
            });
            restoreScrollPosition(scrollY);
        }
    };

    const handleStageTransition = async (project: Project, toStage: ProjectStage) => {
        await proceedStageTransition(project, toStage);
    };

    const getStageLabel = (stage: ProjectStage): string => {
        const labels: Record<ProjectStage, string> = {
            'LEAD': 'Lead',
            'ON_PROGRESS': 'On Progress',
            'QUOTATION_SENT': 'Quotation Sent',
            'IN_REVIEW': 'In Review',
            'ONBOARDED': 'Onboarded',
            'SALES': 'Sales',
            'ACCOUNTS': 'Accounts',
            'INSTALLATION': 'Installation',
            'COMPLETED': 'Completed',
            'DROPPED': 'Dropped'
        };
        return labels[stage] || stage;
    };

    const getNextStage = (currentStage: ProjectStage): ProjectStage | null => {
        const transitions: Record<ProjectStage, ProjectStage | null> = {
            'LEAD': 'ON_PROGRESS',
            'ON_PROGRESS': 'QUOTATION_SENT',
            'QUOTATION_SENT': 'IN_REVIEW',
            'IN_REVIEW': 'ONBOARDED',
            'ONBOARDED': null,
            'SALES': null,
            'ACCOUNTS': null,
            'INSTALLATION': null,
            'COMPLETED': null,
            'DROPPED': null
        };
        return transitions[currentStage];
    };

    // Helper functions to check executive view status (uses server-computed field)
    const isNonOnboarded = (project: Project): boolean => {
        return project.executiveViewStatus === 'NON_ONBOARDED';
    };

    const isOnboardedNotCompleted = (project: Project): boolean => {
        return project.executiveViewStatus === 'ONBOARDED_ACTIVE';
    };

    const isCompleted = (project: Project): boolean => {
        return project.executiveViewStatus === 'COMPLETED';
    };

    const canRequestDeletion = (project: Project): boolean => {
        if (isVirtualExecutiveView) return false;
        return project.currentStage !== 'COMPLETED'
            && project.currentStage !== 'DROPPED'
            && project.deletionRequestStatus !== 'PENDING';
    };

    const canEdit = (project: Project): boolean => {
        if (isVirtualExecutiveView) return false;
        // Completed projects cannot be edited
        if (isCompleted(project)) return false;
        if (isAdmin) return true;
        
        // Non-onboarded projects can be edited by any executive
        if (isNonOnboarded(project)) return true;
        
        // Onboarded projects can only be edited by creator
        if (project.createdBy?.toLowerCase() !== user?.email?.toLowerCase()) return false;
        
        return true;
    };

    const handleProjectSearch = () => {
        const normalizedSearch = searchInput.trim();
        setAppliedTabSearches((prev) => ({ ...prev, [activeTab]: normalizedSearch }));
        setTabPages((prev) => ({ ...prev, [activeTab]: 1 }));
        loadProjects(activeTab, true, 1, normalizedSearch);
    };

    const handleTabChange = (tabId: string) => {
        const nextTab = tabId as ExecutiveTab;
        setActiveTab(nextTab);
        setSearchInput(appliedTabSearches[nextTab] || '');
    };

    const activePage = Math.max(tabPages[activeTab] || 1, 1);
    const activeTotalPages = Math.max(tabTotalPages[activeTab] || 1, 1);
    const activeTotalElements = tabCounts[activeTab] || 0;

    const filteredProjects = React.useMemo(() => {
        if (activeTab === 'onboarded') {
            return [...projects].sort((a, b) => {
                const aPending = Math.max(a.pendingAmount ?? 0, 0);
                const bPending = Math.max(b.pendingAmount ?? 0, 0);
                const aInvoicePending = !a.invoiceAmount || a.invoiceAmount === 0;
                const bInvoicePending = !b.invoiceAmount || b.invoiceAmount === 0;

                if (aPending > 0 || bPending > 0) {
                    if (aPending !== bPending) {
                        return bPending - aPending;
                    }
                }

                if (aInvoicePending !== bInvoicePending) {
                    return aInvoicePending ? -1 : 1;
                }

                return a.school.localeCompare(b.school);
            });
        }
        if (activeTab === 'non-onboarded') {
            return [...projects].sort((left, right) => {
                const leftRank = getNextContactSortRank(left);
                const rightRank = getNextContactSortRank(right);
                if (leftRank.priority !== rightRank.priority) {
                    return leftRank.priority - rightRank.priority;
                }
                if (leftRank.diffDays !== rightRank.diffDays) {
                    return leftRank.diffDays - rightRank.diffDays;
                }
                return left.school.localeCompare(right.school);
            });
        }
        return projects;
    }, [activeTab, projects]);

    const todayVisitProjects = React.useMemo(
        () => tabProjects['non-onboarded'].filter((project) => calculateNextContactStatus(project.nextContact)?.isToday),
        [tabProjects]
    );
    const executiveGreetingAlerts = React.useMemo(() => {
        if (todayVisitProjects.length === 0) {
            return [];
        }
        return [
            `${todayVisitProjects.length} site${todayVisitProjects.length === 1 ? '' : 's'} to be visited today`
        ];
    }, [todayVisitProjects]);

    const tabs = [
        { 
            id: 'non-onboarded', 
            label: 'Non-Onboarded (Leads)',
            count: tabCounts['non-onboarded']
        },
        { 
            id: 'onboarded', 
            label: 'Onboarded (Not Completed)',
            count: tabCounts['onboarded']
        },
        { 
            id: 'completed', 
            label: 'Completed',
            count: tabCounts.completed
        }
    ];

    const creationBlocked = Boolean(projectCreationLimitStatus?.creationBlocked);
    const creationWarningTitle = projectCreationLimitStatus?.title || 'Project creation is temporarily paused';
    const creationWarningMessage = projectCreationLimitStatus?.message || 'New project creation is currently unavailable.';
    const virtualExecutiveName = selectedExecutive?.name || 'selected executive';

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />
                
                <div className="px-4 lg:px-12 py-6 lg:py-10 pb-32">
                    <EmbeddedUserDashboard
                        projects={allProjects}
                        userFirstName={isVirtualExecutiveView ? selectedExecutive?.name?.split(' ')[0] || 'Executive' : user?.name?.split(' ')[0]}
                        alertDetails={executiveGreetingAlerts}
                        alertTone="success"
                        showGreeting
                        greetingAction={isAdmin ? (
                            <button
                                type="button"
                                onClick={() => navigate('/executive-activity-report')}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-700 transition-colors hover:bg-indigo-100 sm:w-auto"
                            >
                                <Calendar size={17} />
                                Today&apos;s Report
                            </button>
                        ) : undefined}
                    />

                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-8 mb-8 animate-premium">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">
                                Sales Executive 
                            </h1>
                            <p className="text-gray-600 text-sm lg:text-base font-medium">
                                {isVirtualExecutiveView
                                    ? `Read-only view of ${virtualExecutiveName}'s projects across every executive stage`
                                    : 'Manage your leads and projects across different stages'}
                            </p>
                        </div>
                        <div className="flex w-full lg:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            {!isVirtualExecutiveView && <button
                                onClick={() => !creationBlocked && setShowCreateModal(true)}
                                disabled={creationBlocked}
                                title={creationBlocked ? creationWarningMessage : 'Create Project'}
                                className={`flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all ${
                                    creationBlocked
                                        ? 'cursor-not-allowed bg-slate-300 text-slate-600 shadow-none'
                                        : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:shadow-lg'
                                }`}
                            >
                                <Plus size={20} />
                                Create Project
                            </button>}
                            {isVirtualExecutiveView && (
                                <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700">
                                    <Eye size={18} />
                                    Viewing {virtualExecutiveName}
                                </div>
                            )}
                        </div>
                    </div>

                    {creationBlocked && !isVirtualExecutiveView && (
                        <div className="mb-6 overflow-hidden rounded-[28px] border border-rose-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_28%),linear-gradient(135deg,rgba(127,29,29,0.98),rgba(190,24,93,0.95)_42%,rgba(251,113,133,0.88))] p-5 text-white shadow-[0_28px_70px_-30px_rgba(190,24,93,0.8)]">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                                    <AlertTriangle size={24} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-100/90">Creation Lock Active</p>
                                    <h2 className="mt-2 text-2xl font-black tracking-tight">{creationWarningTitle}</h2>
                                    <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-rose-50/95">{creationWarningMessage}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

                    {isVirtualExecutiveView && (
                        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-800">
                            <Eye className="mt-0.5 h-4 w-4 shrink-0" />
                            <p><strong>Virtual executive view.</strong> Project actions are disabled; this does not change your logged-in role or permissions.</p>
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="glass-panel rounded-2xl p-4 mb-6 animate-premium shadow-lg">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                type="text"
                                placeholder="Search all accessible projects by customer, contact person, or phone..."
                                value={searchInput}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchInput(value);
                                    if (value.trim() === '' && appliedTabSearches[activeTab]) {
                                        setAppliedTabSearches((prev) => ({ ...prev, [activeTab]: '' }));
                                        setTabPages((prev) => ({ ...prev, [activeTab]: 1 }));
                                        loadProjects(activeTab, true, 1, '');
                                    }
                                }}
                                className="w-full pl-12 pr-14 py-3 bg-white/50 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-sm font-medium placeholder:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={handleProjectSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                                disabled={loading}
                                aria-label="Search projects"
                            >
                                <Search size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex items-center justify-between px-4 py-3 border border-gray-200 bg-white/80 rounded-xl">
                        <p className="text-xs text-gray-600">Total projects: {activeTotalElements}</p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => loadProjects(activeTab, true, activePage - 1, appliedTabSearches[activeTab])}
                                disabled={loading || activePage <= 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-gray-600">Page {activePage} / {activeTotalPages}</span>
                            <button
                                type="button"
                                onClick={() => loadProjects(activeTab, true, activePage + 1, appliedTabSearches[activeTab])}
                                disabled={loading || activePage >= activeTotalPages}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    {/* Projects List */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="glass-panel rounded-2xl p-12 text-center animate-premium">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto"></div>
                                <p className="text-gray-600 mt-4 font-medium">Loading projects...</p>
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="glass-panel rounded-2xl p-12 text-center animate-premium">
                                <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 font-medium">
                                    {activeTab === 'non-onboarded' && (isVirtualExecutiveView ? 'No non-onboarded projects found for this executive.' : 'No leads found. Create your first project!')}
                                    {activeTab === 'onboarded' && 'No onboarded projects found.'}
                                    {activeTab === 'completed' && 'No completed projects yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    executiveDisplayName={getExecutiveDisplayName(project.createdBy)}
                                    showAdminMeta={isAdmin}
                                    activeTab={activeTab}
                                    getStageLabel={getStageLabel}
                                    getNextStage={getNextStage}
                                    canEdit={canEdit}
                                    canRequestDeletion={canRequestDeletion}
                                    onView={() => setSelectedProject(project)}
                                    onAddData={() => setAdditionalDataProject(project)}
                                    onScheduleVisit={() => setVisitProject(project)}
                                    onRequestDeletion={() => handleDeletionRequest(project)}
                                    onStageTransition={handleStageTransition}
                                    isTransitioning={transitioningProjectIds.has(project.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Create Project Modal */}
            {showCreateModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateProject}
                    showZoneSelector={canSwitchZone}
                />
            )}

            {/* Edit Project Modal */}
            {editingProject && (
                <EditProjectModal
                    project={editingProject}
                    onClose={() => setEditingProject(null)}
                    onUpdate={handleUpdateProject}
                    onRequestDeletion={canRequestDeletion(editingProject) ? () => {
                        setEditingProject(null);
                        handleDeletionRequest(editingProject);
                    } : undefined}
                />
            )}

            {additionalDataProject && (
                <ExecutiveAdditionalDataModal
                    project={additionalDataProject}
                    onClose={() => setAdditionalDataProject(null)}
                    onSave={handleUpdateExecutiveAdditionalData}
                />
            )}

            {/* Project Details Modal */}
            {selectedProject && (
                <ProjectDetailsModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    isReadOnly={activeTab === 'completed' || isVirtualExecutiveView}
                    onEdit={canEdit(selectedProject) ? () => {
                        setSelectedProject(null);
                        setEditingProject(selectedProject);
                    } : undefined}
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

            {visitProject && (
                <ScheduleSchoolVisitModal
                    project={visitProject}
                    onClose={() => setVisitProject(null)}
                    onScheduled={() => {
                        setVisitProject(null);
                        void loadProjects(activeTab, true, tabPages[activeTab], appliedTabSearches[activeTab]);
                    }}
                />
            )}

        </div>
    );
};

// Project Card Component
interface ProjectCardProps {
    project: Project;
    executiveDisplayName?: string;
    showAdminMeta: boolean;
    activeTab: string;
    getStageLabel: (stage: ProjectStage) => string;
    getNextStage: (stage: ProjectStage) => ProjectStage | null;
    canEdit: (project: Project) => boolean;
    canRequestDeletion: (project: Project) => boolean;
    onView: () => void;
    onAddData: () => void;
    onScheduleVisit: () => void;
    onRequestDeletion: () => void;
    onStageTransition: (project: Project, toStage: ProjectStage) => void;
    isTransitioning: boolean;
}

const ParentCompanyMultiSelect: React.FC<{
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder = 'Select Parent Companies' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const selectedCompanies = parseParentCompanies(value);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen]);

    const toggleCompany = (company: (typeof PARENT_COMPANY_OPTIONS)[number]) => {
        const nextCompanies = selectedCompanies.includes(company)
            ? selectedCompanies.filter((item) => item !== company)
            : [...selectedCompanies, company];
        onChange(serializeParentCompanies(nextCompanies));
    };

    const removeCompany = (company: (typeof PARENT_COMPANY_OPTIONS)[number]) => {
        onChange(serializeParentCompanies(selectedCompanies.filter((item) => item !== company)));
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full px-4 py-3 bg-white/50 border-2 border-gray-200 rounded-xl text-left focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        {selectedCompanies.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {selectedCompanies.map((company) => (
                                    <span
                                        key={company}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-semibold"
                                    >
                                        {company}
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeCompany(company);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    removeCompany(company);
                                                }
                                            }}
                                        >
                                            <X size={12} />
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-sm font-medium text-gray-400">{placeholder}</span>
                        )}
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {PARENT_COMPANY_OPTIONS.map((company) => {
                        const selected = selectedCompanies.includes(company);
                        return (
                            <button
                                key={company}
                                type="button"
                                onClick={() => toggleCompany(company)}
                                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                                    selected ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <span>{company}</span>
                                {selected && <Check size={16} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    executiveDisplayName,
    showAdminMeta,
    activeTab,
    getStageLabel,
    getNextStage,
    canEdit,
    canRequestDeletion,
    onView,
    onAddData,
    onScheduleVisit,
    onRequestDeletion,
    onStageTransition,
    isTransitioning
}) => {
    const isNonOnboarded = activeTab === 'non-onboarded';
    const isOnboarded = activeTab === 'onboarded';
    const nextContactStatus = React.useMemo(() => {
        if (!isNonOnboarded) {
            return null;
        }
        return calculateNextContactStatus(project.nextContact);
    }, [isNonOnboarded, project.nextContact]);
    const pendingAmount = Math.max(project.pendingAmount ?? 0, 0);
    const hasPendingAmount = pendingAmount > 0;
    const isInvoicePending = !project.invoiceAmount || project.invoiceAmount === 0;

    return (
        <div className="glass-panel rounded-[28px] border border-white/70 bg-gradient-to-br from-white/90 via-white/85 to-brand-50/40 p-4 shadow-[0_20px_55px_-35px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_65px_-34px_rgba(37,99,235,0.35)] sm:p-6">
            {isNonOnboarded && nextContactStatus?.isToday && (
                <div className={`mb-4 rounded-2xl border px-4 py-3 ${nextContactStatus.bannerClassName}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/80">Today's Visit Priority</p>
                            <p className="mt-1 text-base font-black">Site visit scheduled for today</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                            {nextContactStatus.shortLabel}
                        </span>
                    </div>
                </div>
            )}
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="flex min-w-0 items-center gap-2 text-xl font-black tracking-tight text-slate-900">
                            <Building2 size={20} className="shrink-0 text-brand-600" aria-hidden="true" />
                            <span className="truncate">{project.school}</span>
                        </h3>
                        {showAdminMeta && <ExecutiveInfoHover executiveName={executiveDisplayName} zone={project.zone} />}
                    </div>
                    {project.projectName && (
                        <p className="flex items-center gap-2 text-sm font-semibold">
                            <Briefcase size={16} className="shrink-0 text-brand-600" aria-hidden="true" />
                            <span className="text-slate-900">Project:</span>
                            <span className="truncate text-brand-700">{project.projectName}</span>
                        </p>
                    )}
                    <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2 w-full">
                            {project.contactPerson && (
                                <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-2xl sm:rounded-full border border-slate-200 bg-white/70 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-600">
                                    <User size={16} className="shrink-0" aria-hidden="true" />
                                    <span className="truncate">{project.contactPerson}</span>
                                </span>
                            )}
                            {project.createdDate && (
                                <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-2xl sm:rounded-full border border-slate-200 bg-white/70 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-600">
                                    <Calendar size={16} className="shrink-0" aria-hidden="true" />
                                    <span className="truncate">
                                        {new Intl.DateTimeFormat('en-GB', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit'
                                        }).format(new Date(project.createdDate))}
                                    </span>
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 w-full">
                            {project.place && (
                                <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-2xl sm:rounded-full border border-slate-200 bg-white/70 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-600">
                                    <MapPin size={16} className="shrink-0" aria-hidden="true" />
                                    <span className="truncate">{project.place}, {project.district}</span>
                                </span>
                            )}
                            <span className="flex-1 min-w-0 inline-flex items-center justify-center rounded-2xl sm:rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-sm">
                                <span className="truncate">{getStageLabel(project.currentStage)}</span>
                            </span>
                        </div>
                        {project.deletionRequestStatus === 'PENDING' && (
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-200 shrink-0">
                                    Frozen
                                </span>
                                <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold border border-amber-200 shrink-0">
                                    Pending Deletion Approval
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isOnboarded && (
                <div className={`mb-4 overflow-hidden rounded-3xl border ${
                    isInvoicePending ? 'border-blue-200 bg-gradient-to-r from-blue-50 via-white to-sky-50' :
                    hasPendingAmount ? 'border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50' : 
                    'border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50'
                }`}>
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${
                                isInvoicePending ? 'text-blue-700' :
                                hasPendingAmount ? 'text-amber-700' : 
                                'text-emerald-700'
                            }`}>
                                Payment Status
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                {isInvoicePending ? (
                                    <FileText size={18} className="text-blue-600" />
                                ) : hasPendingAmount ? (
                                    <Wallet size={18} className="text-amber-600" />
                                ) : (
                                    <BadgeCheck size={18} className="text-emerald-600" />
                                )}
                                <p className={`text-base font-black sm:text-lg ${
                                    isInvoicePending ? 'text-blue-950' :
                                    hasPendingAmount ? 'text-amber-950' : 
                                    'text-emerald-950'
                                }`}>
                                    {isInvoicePending ? 'Awaiting Invoice' : hasPendingAmount ? 'Pending Amount' : 'Amount Received'}
                                </p>
                            </div>
                            <p className={`mt-1 text-sm font-medium ${
                                isInvoicePending ? 'text-blue-800' :
                                hasPendingAmount ? 'text-amber-800' : 
                                'text-emerald-800'
                            }`}>
                                {isInvoicePending ? 'Invoice amount has not been entered yet. Payment tracking will begin once updated.' : 
                                 hasPendingAmount ? 'Payment follow-up is still required for this onboarded project.' : 
                                 'This onboarded project has no outstanding balance.'}
                            </p>
                        </div>
                        <div className={`shrink-0 rounded-2xl border px-4 py-3 text-right shadow-sm ${
                            isInvoicePending ? 'border-blue-200 bg-white/80 text-blue-900' :
                            hasPendingAmount ? 'border-amber-200 bg-white/80 text-amber-900' : 
                            'border-emerald-200 bg-white/80 text-emerald-900'
                        }`}>
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-70">
                                {isInvoicePending ? 'Status' : hasPendingAmount ? 'Pending' : 'Received'}
                            </p>
                            <p className={`mt-1 font-black ${isInvoicePending ? 'text-lg' : 'text-2xl'}`}>
                                {isInvoicePending ? 'Pending' : hasPendingAmount ? formatCurrency(pendingAmount) : 'Fully Paid'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stage Progress Bar (for non-onboarded only) */}
            {isNonOnboarded && (
                <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/60 p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                        {['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED'].map((stage) => (
                            <div key={stage} className="text-center">
                                <div className={`text-[11px] sm:text-xs font-medium ${project.currentStage === stage ? 'text-brand-600 font-bold' : 'text-gray-500'}`}>
                                    {getStageLabel(stage as ProjectStage)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="relative">
                        <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
                            <div 
                                className="h-2 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-300"
                                style={{
                                    width: `${Math.max(0, (['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW', 'ONBOARDED'].indexOf(project.currentStage) + 1) * 20)}%`
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isNonOnboarded && nextContactStatus && (
                <div className="mb-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${nextContactStatus.className}`}>
                        Next Contact: {nextContactStatus.label}
                    </span>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto">
                    <button
                        onClick={onView}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-brand-100 bg-brand-50/80 px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all hover:bg-brand-100 min-w-0"
                    >
                        <Eye size={16} className="shrink-0" />
                        <span className="truncate">View</span>
                    </button>
                    {canEdit(project) && (
                        <button
                            type="button"
                            onClick={onAddData}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-all hover:bg-violet-100 min-w-0"
                        >
                            <Plus size={16} className="shrink-0" />
                            <span className="truncate">Add Data</span>
                        </button>
                    )}
                    {isNonOnboarded && canEdit(project) && (
                        <button
                            type="button"
                            onClick={onScheduleVisit}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100 min-w-0"
                        >
                            <Calendar size={16} className="shrink-0" />
                            <span className="truncate">Schedule Visit</span>
                        </button>
                    )}
                </div>
                {isNonOnboarded && getNextStage(project.currentStage) && !project.isLocked && (
                    <button
                        onClick={() => onStageTransition(project, getNextStage(project.currentStage)!)}
                        disabled={isTransitioning}
                        className="w-full lg:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                    >
                        <span className="truncate">{isTransitioning ? 'Moving...' : `Move to ${getStageLabel(getNextStage(project.currentStage)!)}`}</span>
                        {!isTransitioning && <ArrowRight size={16} className="shrink-0" />}
                    </button>
                )}
            </div>
        </div>
    );
};

const ScheduleSchoolVisitModal: React.FC<{
    project: Project;
    onClose: () => void;
    onScheduled: () => void;
}> = ({ project, onClose, onScheduled }) => {
    const { showToast } = useToast();
    const [scheduledFor, setScheduledFor] = useState(getTodayDateInputValue());
    const [nextContact, setNextContact] = useState('');
    const [executiveRemark, setExecutiveRemark] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            await schoolVisitApi.schedule(project.id, {
                scheduledFor,
                nextContact: nextContact || undefined,
                executiveRemark: executiveRemark.trim()
            });
            showToast('Site visit scheduled.', 'success');
            onScheduled();
        } catch (error: any) {
            showToast(error.message || 'Failed to schedule site visit.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
                <h2 className="text-xl font-black text-slate-900">Schedule site visit</h2>
                <p className="mt-1 text-sm text-slate-600">{project.school}</p>
                <label className="mt-5 block text-sm font-bold text-slate-700">Visit date
                    <input required type="date" min={getTodayDateInputValue()} value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                    <span className="font-bold">Last Contact Date:</span> automatically recorded as today when this visit is scheduled.
                </div>
                <label className="mt-4 block text-sm font-bold text-slate-700">Next contact date <span className="font-normal text-slate-400">(optional)</span>
                    <input type="date" min={scheduledFor || getTodayDateInputValue()} value={nextContact} onChange={(event) => setNextContact(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="mt-4 block text-sm font-bold text-slate-700">Executive remark <span className="text-rose-500">*</span>
                    <textarea required value={executiveRemark} onChange={(event) => setExecutiveRemark(event.target.value)} maxLength={4000} rows={4} placeholder="Add the latest customer discussion, requirement, or follow-up context" className="mt-2 w-full resize-none rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                </label>
                <p className="mt-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-medium leading-5 text-violet-800">This becomes the project's current Executive Remark and remains attached to this scheduled visit.</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Scheduling…' : 'Schedule visit'}</button>
                </div>
            </form>
        </div>
    );
};

const SchoolVisitOutcomeModal: React.FC<{
    visit: SchoolVisit;
    onClose: () => void;
    onRecorded: () => void;
}> = ({ visit, onClose, onRecorded }) => {
    const { showToast } = useToast();
    const [visited, setVisited] = useState<boolean | null>(null);
    const [details, setDetails] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (visited === null) {
            showToast('Select whether the site was visited.', 'error');
            return;
        }
        if (!details.trim()) {
            showToast(visited ? 'Enter a visit note.' : 'Enter the reason the site was not visited.', 'error');
            return;
        }
        setSaving(true);
        try {
            await schoolVisitApi.recordOutcome(visit.id, visited
                ? { visited: true, visitNote: details.trim() }
                : { visited: false, notVisitedReason: details.trim() });
            showToast('Site visit outcome recorded.', 'success');
            onRecorded();
        } catch (error: any) {
            showToast(error.message || 'Failed to record visit outcome.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Today&apos;s site visit</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{visit.school}</h2>
                <p className="mt-2 text-sm text-slate-600">Was this site visited?</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setVisited(true)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${visited === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Yes, visited</button>
                    <button type="button" onClick={() => setVisited(false)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${visited === false ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>No, not visited</button>
                </div>
                {visited !== null && (
                    <label className="mt-5 block text-sm font-bold text-slate-700">{visited ? 'Visit note' : 'Reason not visited'}
                        <textarea required value={details} onChange={(event) => setDetails(event.target.value)} maxLength={visited ? 8000 : 4000} rows={5} placeholder={visited ? 'What happened during the visit?' : 'Why could the visit not happen?'} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </label>
                )}
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button disabled={saving || visited === null} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save outcome'}</button>
                </div>
            </form>
        </div>
    );
};

const ExecutiveProjectFormModal: React.FC<{
    title: string;
    subtitle: string;
    submitLabel: string;
    initialFormData: CreateProjectRequest;
    onClose: () => void;
    onSubmit: (data: CreateProjectRequest) => Promise<void>;
    allowTodayForNextContact?: boolean;
    onRequestDeletion?: () => void;
    showZoneSelector?: boolean;
}> = ({ title, subtitle, submitLabel, initialFormData, onClose, onSubmit, allowTodayForNextContact = false, onRequestDeletion, showZoneSelector = false }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState<CreateProjectRequest>(() => ({
        ...initialFormData,
        zone: showZoneSelector ? (initialFormData.zone || 'ZONE_1') : initialFormData.zone
    }));
    const [districtSearch, setDistrictSearch] = useState(initialFormData.district || '');
    const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
    const [filteredDistricts, setFilteredDistricts] = useState<string[]>([...KERALA_DISTRICTS]);
    const [showOnboardingRule, setShowOnboardingRule] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const districtDropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (districtSearch) {
            const filtered = KERALA_DISTRICTS.filter((district) =>
                district.toLowerCase().includes(districtSearch.toLowerCase())
            );
            setFilteredDistricts(filtered);
        } else {
            setFilteredDistricts([...KERALA_DISTRICTS]);
        }
    }, [districtSearch]);

    useEffect(() => {
        if (!showDistrictDropdown) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!districtDropdownRef.current?.contains(event.target as Node)) {
                setShowDistrictDropdown(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [showDistrictDropdown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!formData.lastContact) {
            showToast('Last contact date is required.', 'error');
            return;
        }
        const validationMessage = validateExecutiveProjectForm(formData, { allowTodayForNextContact });
        if (validationMessage) {
            showToast(validationMessage, 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDistrictSelect = (district: string) => {
        setFormData({ ...formData, district });
        setDistrictSearch(district);
        setShowDistrictDropdown(false);
    };

    const inputClassName =
        'w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-sm font-medium text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';
    const selectClassName =
        'w-full appearance-none rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-sm font-medium text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';
    const feedbackToneMap: Record<FirstMeetingOutcome, string> = {
        POSITIVE: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        FIFTY_FIFTY: 'text-amber-700 bg-amber-50 border-amber-200',
        NEGATIVE: 'text-rose-700 bg-rose-50 border-rose-200'
    };
    const feedbackLabelMap: Record<FirstMeetingOutcome, string> = {
        POSITIVE: 'Positive Momentum',
        FIFTY_FIFTY: '50-50 Follow-up',
        NEGATIVE: 'Negative Signal'
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/70 p-4 shadow-[0_35px_90px_-35px_rgba(15,23,42,0.5)] sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 rounded-[28px] bg-gradient-to-r from-slate-950 via-brand-900 to-cyan-800 px-5 py-5 text-white shadow-[0_25px_60px_-30px_rgba(15,23,42,0.9)] sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-blue-100">
                                Executive Intake
                            </div>
                            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
                            <p className="mt-2 max-w-2xl text-sm text-blue-100/90">{subtitle}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                                    Premium Lead Entry
                                </span>
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                                    Clean Data Capture
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl font-bold text-white transition hover:bg-white/20"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="mb-5 rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 px-5 py-4 shadow-[0_18px_40px_-28px_rgba(245,158,11,0.55)]">
                    <button
                        type="button"
                        onClick={() => setShowOnboardingRule((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                            <AlertTriangle size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">Onboarding Rule</p>
                            <p className="mt-1 text-sm font-semibold text-amber-900">Required before onboarding. Click to {showOnboardingRule ? 'hide' : 'view'} details.</p>
                        </div>
                        <ChevronDown className={`shrink-0 text-amber-700 transition-transform ${showOnboardingRule ? 'rotate-180' : ''}`} size={20} />
                    </button>
                    {showOnboardingRule && (
                        <div className="mt-4 border-t border-amber-200/80 pt-4">
                            <p className="text-sm font-semibold text-amber-900">
                                {getExecutiveOnboardingRequirementsMessage()}
                            </p>
                            <p className="mt-1 text-xs font-medium text-amber-700/90">
                                These fields are not mandatory while creating the project, but they must be completed before the project can move to onboarded.
                            </p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {showZoneSelector && (
                        <FormSectionCard icon={<MapPin size={20} />} title="Admin Zone Assignment" description="Choose the executive zone that should own this project after creation.">
                            <div className="rounded-[18px] border border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/80 p-2 sm:rounded-[22px] sm:p-3">
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    {ADMIN_PROJECT_ZONE_OPTIONS.map((option) => {
                                        const selected = formData.zone === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => setFormData({ ...formData, zone: option.value })}
                                                className={`group rounded-xl border px-2 py-2 text-center transition-all sm:rounded-2xl sm:p-4 sm:text-left ${
                                                    selected
                                                        ? 'border-brand-500 bg-gradient-to-br from-brand-600 via-blue-600 to-cyan-600 text-white shadow-[0_12px_28px_-20px_rgba(37,99,235,0.95)] ring-2 ring-brand-100 sm:shadow-[0_18px_40px_-24px_rgba(37,99,235,0.95)] sm:ring-4'
                                                        : 'border-white/80 bg-white/85 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.08em] sm:text-sm sm:tracking-[0.18em] ${selected ? 'text-blue-50' : 'text-brand-700'}`}>
                                                        {option.label}
                                                    </span>
                                                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border sm:h-7 sm:w-7 ${
                                                        selected ? 'border-white/30 bg-white/20 text-white' : 'border-brand-100 bg-brand-50 text-brand-600 group-hover:bg-brand-100'
                                                    }`}>
                                                        {selected ? <Check size={12} /> : <MapPin size={11} />}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </FormSectionCard>
                    )}

                    <div className="grid gap-5 xl:grid-cols-2">
                        <FormSectionCard icon={<Building2 size={20} />} title="Customer Information" description="Start with the identity of the institution and the lead opportunity.">
                            <div className="space-y-4">
                                <div>
                                    <FormFieldLabel title="Customer Name" required />
                                    <input type="text" required value={formData.school} onChange={(e) => setFormData({ ...formData, school: e.target.value })} className={inputClassName} placeholder="Enter customer name" />
                                </div>
                                <div>
                                    <FormFieldLabel title="Project Name" required />
                                    <input type="text" value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} className={inputClassName} placeholder="e.g., Smart Room Setup" />
                                </div>
                            </div>
                        </FormSectionCard>

                        <FormSectionCard icon={<User size={20} />} title="Contact Information" description="Keep the next conversation and relationship details easy to review.">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <FormFieldLabel title="Contact Person" required />
                                    <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: sanitizeNameInput(e.target.value) })} className={inputClassName} placeholder="Contact person name" />
                                </div>
                                <div>
                                    <FormFieldLabel title="Contact Number" required />
                                    <input type="text" value={formData.contactNumber} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} className={inputClassName} placeholder="+91 XXXXX XXXXX" />
                                </div>
                                <div>
                                    <FormFieldLabel title="Last Contact Date" required />
                                    <input type="date" required value={formData.lastContact || ''} onChange={(e) => setFormData({ ...formData, lastContact: e.target.value })} max={getTodayDateInputValue()} className={inputClassName} />
                                    <p className="mt-2 text-xs font-medium text-gray-500">Defaults to today. You can change it if needed.</p>
                                </div>
                                <div>
                                    <FormFieldLabel title="Next Contact Date" />
                                    <input type="date" value={formData.nextContact || ''} onChange={(e) => setFormData({ ...formData, nextContact: e.target.value })} min={allowTodayForNextContact ? getTodayDateInputValue() : getTomorrowDateInputValue()} className={inputClassName} />
                                    <p className="mt-2 text-xs font-medium text-gray-500">Optional. Set the next follow-up date if it is already known.</p>
                                </div>
                            </div>
                        </FormSectionCard>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                        <FormSectionCard icon={<MapPin size={20} />} title="Location Details" description="Capture where the customer is located and make district selection easier to search.">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <FormFieldLabel title="Place" required />
                                    <input type="text" value={formData.place} onChange={(e) => setFormData({ ...formData, place: sanitizePlaceInput(e.target.value) })} className={inputClassName} placeholder="City/Town" />
                                </div>
                                  <div>
                                     <FormFieldLabel title="District" required />
                                      <div ref={districtDropdownRef} className="relative">
                                          <div className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Find</div>
                                          <input
                                              type="text"
                                            value={districtSearch}
                                            onChange={(e) => {
                                                setDistrictSearch(e.target.value);
                                                setShowDistrictDropdown(true);
                                                if (!e.target.value) {
                                                    setFormData({ ...formData, district: '' });
                                                }
                                            }}
                                            onFocus={() => setShowDistrictDropdown(true)}
                                            className={`${inputClassName} pl-16 pr-11`}
                                            placeholder="Search district..."
                                          />
                                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                          {showDistrictDropdown && filteredDistricts.length > 0 ? (
                                              <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                                                  {filteredDistricts.map((district) => (
                                                      <div key={district} onClick={() => handleDistrictSelect(district)} className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-brand-50">
                                                          {district}
                                                      </div>
                                                  ))}
                                              </div>
                                          ) : null}
                                      </div>
                                  </div>
                            </div>
                        </FormSectionCard>

                        <FormSectionCard icon={<Briefcase size={20} />} title="Business Details" description="Keep the commercial details structured before the project moves down the line.">
                            <div>
                                <FormFieldLabel title="Parent Company" required />
                                <ParentCompanyMultiSelect value={formData.parentCompany || ''} onChange={(value) => setFormData({ ...formData, parentCompany: value })} placeholder="Select Parent Companies" />
                            </div>
                            <div className="mt-4">
                                <FormFieldLabel title="Project Value (INR)" hint="Optional while creating" />
                                <input
                                    type="text"
                                    value={formData.projectValue ? formatIndianNumber(formData.projectValue.toString()) : ''}
                                    onChange={(e) => setFormData({ ...formData, projectValue: parseOptionalIndianNumberInput(e.target.value) })}
                                    className={inputClassName}
                                    placeholder="Enter project value"
                                />
                            </div>
                            <div className="mt-4">
                                <FormFieldLabel title="Is Extra Work Needed?" required />
                                <div className="relative">
                                    <select value={formData.isExtraWorkNeeded ? 'YES' : 'NO'} onChange={(e) => setFormData({ ...formData, isExtraWorkNeeded: e.target.value === 'YES' })} className={selectClassName}>
                                        <option value="NO">No extra work needed</option>
                                        <option value="YES">Yes, extra work expected</option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                </div>
                                <p className="mt-2 text-xs font-medium text-gray-500">Mark this only when the lead needs extra operational scope beyond the standard project flow.</p>
                            </div>
                        </FormSectionCard>
                    </div>

                    <FormSectionCard icon={<FileText size={20} />} title="Additional Information" description="Capture the meeting signal and any notes the next owner should immediately understand.">
                        <div>
                            <FormFieldLabel title="Executive Remarks" />
                            <textarea value={formData.executiveRemarks} onChange={(e) => setFormData({ ...formData, executiveRemarks: e.target.value })} rows={3} className={`${inputClassName} resize-none`} placeholder="Add any notes or remarks about this lead..." />
                        </div>
                        <div className="mt-5">
                            <FormFieldLabel title="First Meeting Feedback" required />
                            <div className="relative">
                                <select value={formData.firstMeetingOutcome || ''} onChange={(e) => setFormData({ ...formData, firstMeetingOutcome: (e.target.value || undefined) as FirstMeetingOutcome | undefined })} className={selectClassName}>
                                    <option value="">Select meeting feedback</option>
                                    <option value="POSITIVE">Positive</option>
                                    <option value="FIFTY_FIFTY">50-50</option>
                                    <option value="NEGATIVE">Negative</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            </div>
                            {formData.firstMeetingOutcome ? (
                                <div className={`mt-4 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${feedbackToneMap[formData.firstMeetingOutcome]}`}>
                                    {feedbackLabelMap[formData.firstMeetingOutcome]}
                                </div>
                            ) : (
                                <p className="mt-4 text-xs font-medium text-gray-500">Select a clear meeting outcome so the next follow-up starts with the right context.</p>
                            )}
                        </div>
                        <div className="mt-5">
                            <FormFieldLabel title="Customer Location Link (Google Maps)" required />
                            <textarea value={formData.schoolLocationLink || ''} onChange={(e) => setFormData({ ...formData, schoolLocationLink: e.target.value })} rows={2} className={`${inputClassName} resize-none`} placeholder="Paste Google Maps link" />
                        </div>
                    </FormSectionCard>

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        {onRequestDeletion ? (
                            <button type="button" onClick={onRequestDeletion} disabled={isSubmitting} className="w-full sm:w-auto rounded-2xl border border-red-200 bg-red-50 px-6 py-3 font-semibold text-red-700 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 shrink-0">
                                <AlertTriangle size={18} />
                                Request Deletion
                            </button>
                        ) : <div />}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-2xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
                                Cancel
                            </button>
                            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-gradient-to-r from-brand-600 via-blue-600 to-cyan-600 px-6 py-3 font-semibold text-white shadow-[0_20px_45px_-25px_rgba(37,99,235,0.95)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_55px_-28px_rgba(37,99,235,0.95)] disabled:cursor-not-allowed disabled:opacity-60">
                                {isSubmitting ? 'Saving...' : submitLabel}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CreateProjectModal: React.FC<{
    onClose: () => void;
    onCreate: (data: CreateProjectRequest) => Promise<void>;
    showZoneSelector?: boolean;
}> = ({ onClose, onCreate, showZoneSelector = false }) => {
    const todayDate = getTodayDateInputValue();
    return (
        <ExecutiveProjectFormModal
            title="Create New Project"
            subtitle="Capture the lead cleanly, set the next touchpoint, and keep the project ready for a disciplined pipeline handoff."
            submitLabel="Create Project"
            initialFormData={{
                school: '',
                contactPerson: '',
                contactNumber: '',
                place: '',
                district: '',
                projectName: '',
                parentCompany: '',
                executiveRemarks: '',
                schoolLocationLink: '',
                lastContact: todayDate,
                nextContact: '',
                firstMeetingOutcome: undefined,
                projectValue: undefined,
                isExtraWorkNeeded: false,
                zone: showZoneSelector ? 'ZONE_1' : undefined
            }}
            onClose={onClose}
            onSubmit={onCreate}
            allowTodayForNextContact
            showZoneSelector={showZoneSelector}
        />
    );
};

const EditProjectModal: React.FC<{
    project: Project;
    onClose: () => void;
    onUpdate: (id: number, data: CreateProjectRequest) => Promise<void>;
    onRequestDeletion?: () => void;
}> = ({ project, onClose, onUpdate, onRequestDeletion }) => (
    <ExecutiveProjectFormModal
        title="Edit Project"
        subtitle="Update project details using the same premium executive intake form."
        submitLabel="Update Project"
        initialFormData={{
            school: project.school || '',
            contactPerson: project.contactPerson || '',
            contactNumber: project.contactNumber || '',
            place: project.place || '',
            district: project.district || '',
            projectName: project.projectName || '',
            parentCompany: normalizeParentCompany(project.parentCompany),
            executiveRemarks: project.executiveRemarks || '',
            schoolLocationLink: project.schoolLocationLink || '',
            lastContact: project.lastContact || '',
            nextContact: project.nextContact || '',
            firstMeetingOutcome: project.firstMeetingOutcome,
            projectValue: project.projectValue,
            isExtraWorkNeeded: project.isExtraWorkNeeded ?? false
        }}
        onClose={onClose}
        onSubmit={(data) => onUpdate(project.id, data)}
        onRequestDeletion={onRequestDeletion}
    />
);

const ExecutiveAdditionalDataModal: React.FC<{
    project: Project;
    onClose: () => void;
    onSave: (id: number, data: UpdateExecutiveAdditionalDataRequest) => Promise<void>;
}> = ({ project, onClose, onSave }) => {
    const [formData, setFormData] = useState<UpdateExecutiveAdditionalDataRequest>({
        brc: project.brc || undefined,
        projectCategory: project.projectCategory,
        projectType: project.projectType,
        enquiryType: project.enquiryType,
        needHelp: project.needHelp,
        salesOfficeRemark: project.salesOfficeRemark
    });
    const [saving, setSaving] = useState(false);
    const inputClassName = 'w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-sm font-medium text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100';

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await onSave(project.id, {
                ...formData,
                brc: formData.brc?.trim() || undefined
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/70 p-4 shadow-[0_35px_90px_-35px_rgba(15,23,42,0.5)] sm:p-6" onClick={(event) => event.stopPropagation()}>
                <div className="mb-6 rounded-[28px] bg-gradient-to-r from-violet-950 via-violet-800 to-brand-700 px-5 py-5 text-white shadow-[0_25px_60px_-30px_rgba(76,29,149,0.9)] sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-violet-100">Executive Additional Data</div>
                            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Add project data</h2>
                            <p className="mt-2 text-sm text-violet-100/90">Capture optional customer sheet details for <span className="font-bold text-white">{project.school}</span>. None of these fields are required during project creation.</p>
                        </div>
                        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20" aria-label="Close additional data form"><X size={20} /></button>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <FormSectionCard icon={<FileText size={20} />} title="Customer sheet details" description="These fields are maintained by the executive and remain optional.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <FormFieldLabel title="Cluster" />
                                <input className={inputClassName} value={formData.brc || ''} maxLength={255} onChange={(event) => setFormData((current) => ({ ...current, brc: event.target.value || undefined }))} placeholder="Enter cluster" />
                            </div>
                            <div>
                                <FormFieldLabel title="Category" />
                                <input
                                    type="text"
                                    className={inputClassName}
                                    value={formData.projectCategory || ''}
                                    maxLength={1000}
                                    onChange={(event) => setFormData((current) => ({ ...current, projectCategory: event.target.value || undefined }))}
                                    placeholder="Enter category"
                                />
                            </div>
                            <div>
                                <FormFieldLabel title="Project" />
                                <select className={inputClassName} value={formData.projectType || ''} onChange={(event) => setFormData((current) => ({ ...current, projectType: (event.target.value || undefined) as ExecutiveProjectCategory | undefined }))}>
                                    <option value="">Select project</option>
                                    {EXECUTIVE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FormFieldLabel title="Enquiry" />
                                <select className={inputClassName} value={formData.enquiryType || ''} onChange={(event) => setFormData((current) => ({ ...current, enquiryType: (event.target.value || undefined) as EnquiryType | undefined }))}>
                                    <option value="">Select enquiry</option>
                                    {ENQUIRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FormFieldLabel title="Need Help" />
                                <select className={inputClassName} value={formData.needHelp || ''} onChange={(event) => setFormData((current) => ({ ...current, needHelp: (event.target.value || undefined) as NeedHelp | undefined }))}>
                                    <option value="">Select help requirement</option>
                                    {NEED_HELP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FormFieldLabel title="Sales Office Remark" />
                                <select className={inputClassName} value={formData.salesOfficeRemark || ''} onChange={(event) => setFormData((current) => ({ ...current, salesOfficeRemark: (event.target.value || undefined) as SalesOfficeRemark | undefined }))}>
                                    <option value="">Select sales office remark</option>
                                    {SALES_OFFICE_REMARK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </FormSectionCard>

                    <FormSectionCard icon={<Info size={20} />} title="Automatically synced fields" description="These values are displayed for reference and cannot be changed here.">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                ['Last Visit', formatOptionalDate(project.lastVisitDate)],
                                ['Sales Office', project.salesOffice ? 'TRUE' : 'FALSE'],
                                ['Payment', project.paymentStatus || 'PENDING']
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-500">{label}</p>
                                    <p className="mt-1 text-sm font-bold text-violet-950">{value}</p>
                                </div>
                            ))}
                        </div>
                    </FormSectionCard>

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
                        <button type="submit" disabled={saving} className="rounded-2xl bg-gradient-to-r from-violet-600 via-brand-600 to-cyan-600 px-6 py-3 font-semibold text-white shadow-[0_20px_45px_-25px_rgba(109,40,217,0.95)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : 'Save Additional Data'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Simple Project Details Modal Component
const ProjectDetailsModal: React.FC<{
    project: Project;
    onClose: () => void;
    isReadOnly?: boolean;
    onEdit?: () => void;
}> = ({ project, onClose, isReadOnly = false, onEdit }) => {
    const isCompletedProjectView = (target: Project) =>
        target.currentStage === 'COMPLETED' || target.executiveViewStatus === 'COMPLETED';

    const formatDate = (value?: string) => {
        if (!value) return 'Not set';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return value;
        return dt.toLocaleDateString('en-GB');
    };

    const getNextContactMeta = (nextContact?: string) => {
        if (!nextContact) {
            return { label: 'Next contact date not set', className: 'text-gray-600 bg-gray-100 border-gray-200' };
        }
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const due = new Date(nextContact);
        const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffDays = Math.ceil((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                label: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`,
                className: 'text-red-700 bg-red-100 border-red-200'
            };
        }
        if (diffDays === 0) {
            return {
                label: 'Due today',
                className: 'text-green-700 bg-green-100 border-green-200'
            };
        }
        return {
            label: `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`,
            className: 'text-green-700 bg-green-100 border-green-200'
        };
    };

    const isCompletedProject = isCompletedProjectView(project);
    const isNonOnboardedProject = ['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW'].includes(project.currentStage);
    const nextContactMeta = getNextContactMeta(project.nextContact);
    const projectValueLabel = project.projectValue ? `₹${project.projectValue.toLocaleString('en-IN')}` : 'Not set';
    const locationLabel = [project.place, project.district].filter(Boolean).join(', ') || 'Not set';
    const firstMeetingLabel =
        project.firstMeetingOutcome === 'FIFTY_FIFTY'
            ? '50-50'
            : project.firstMeetingOutcome
                ? project.firstMeetingOutcome.charAt(0) + project.firstMeetingOutcome.slice(1).toLowerCase()
                : 'Not recorded';
    const createdTimestamp = project.createdDate || (project as Project & { createdAt?: string }).createdAt;
    const lastEditedLabel = project.lastUpdatedAt
        ? new Date(project.lastUpdatedAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
        : 'Not updated yet';
    const createdAtLabel = createdTimestamp
        ? new Date(createdTimestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
        : 'Not available';
    const detailCardClassName = 'rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm';
    const detailLabelClassName = 'text-[11px] font-black uppercase tracking-[0.18em] text-gray-400';

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[140] p-4" onClick={onClose}>
            <div className="glass-panel rounded-[30px] p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-6 rounded-[28px] bg-gradient-to-r from-slate-950 via-brand-900 to-cyan-800 px-5 py-5 text-white shadow-[0_25px_60px_-30px_rgba(15,23,42,0.9)] sm:px-6">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-blue-100">
                                Project Overview
                            </div>
                            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{project.school}</h2>
                            <p className="mt-2 text-sm text-blue-100/90">
                                Review the full executive intake, current status, and the latest updates captured for this project.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                                    {project.projectName || 'Project Name Not Set'}
                                </span>
                                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                                    {project.currentStage}
                                </span>
                                {project.executiveViewStatus && (
                                    <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                                        {project.executiveViewStatus}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl leading-none text-white transition hover:bg-white/20"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className={`${detailCardClassName} md:col-span-2`}>
                            <p className={detailLabelClassName}>Project Name</p>
                            <p className="mt-2 text-lg font-bold text-gray-900">{project.projectName || 'Not set'}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Project Value</p>
                            <p className="mt-2 text-lg font-bold text-gray-900">{projectValueLabel}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Current Stage</p>
                            <span className="mt-2 inline-flex rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                                {project.currentStage}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Customer</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{project.school}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Contact Person</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{project.contactPerson || 'Not set'}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Contact Number</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{project.contactNumber || 'Not set'}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Location</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{locationLabel}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Parent Company</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{project.parentCompany || 'Not set'}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Extra Work Needed</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{project.isExtraWorkNeeded ? 'Yes' : 'No'}</p>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-4 shadow-sm sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                                <Plus size={18} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700">Add Data Details</p>
                                <p className="mt-1 text-sm font-medium text-slate-600">Executive-entered customer details and the values synchronized from the project workflow.</p>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {[
                                ['Cluster', project.brc || 'Not set'],
                                ['Category', formatExecutiveAdditionalDataValue(project.projectCategory)],
                                ['Project Type', formatExecutiveAdditionalDataValue(project.projectType)],
                                ['Enquiry', formatExecutiveAdditionalDataValue(project.enquiryType)],
                                ['Last Visit', formatOptionalDate(project.lastVisitDate)],
                                ['Need Help', formatExecutiveAdditionalDataValue(project.needHelp)],
                                ['Sales Office', project.salesOffice ? 'TRUE' : 'FALSE'],
                                ['Sales Head', project.salesHead ? 'TRUE' : 'FALSE'],
                                ['Sales Office Remark', formatExecutiveAdditionalDataValue(project.salesOfficeRemark)],
                                ['Payment', project.paymentStatus || 'PENDING']
                            ].map(([label, value]) => (
                                <div key={label} className={detailCardClassName}>
                                    <p className={detailLabelClassName}>{label}</p>
                                    <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Last Contact Date</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">
                                {isNonOnboardedProject ? formatDate(project.lastContact) : 'Not applicable after onboarding'}
                            </p>
                        </div>
                        {!isCompletedProject && (
                            <div className={detailCardClassName}>
                                <p className={detailLabelClassName}>Next Contact Date</p>
                                <p className="mt-2 text-sm font-semibold text-gray-900">
                                    {isNonOnboardedProject ? formatDate(project.nextContact) : 'Not applicable after onboarding'}
                                </p>
                                {isNonOnboardedProject && (
                                    <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${nextContactMeta.className}`}>
                                        {nextContactMeta.label}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>First Meeting Feedback</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{firstMeetingLabel}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Location Link</p>
                            {project.schoolLocationLink ? (
                                <a
                                    href={project.schoolLocationLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4"
                                >
                                    Open customer location
                                </a>
                            ) : (
                                <p className="mt-2 text-sm font-semibold text-gray-900">Not added</p>
                            )}
                        </div>
                    </div>

                    <div className={detailCardClassName}>
                        <p className={detailLabelClassName}>Executive Remarks</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-gray-800">
                            {project.executiveRemarks || 'No remarks added.'}
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Created At</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{createdAtLabel}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Last Updated By</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{project.lastUpdatedBy || 'Not updated yet'}</p>
                        </div>
                        <div className={detailCardClassName}>
                            <p className={detailLabelClassName}>Last Updated Time</p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">{lastEditedLabel}</p>
                        </div>
                    </div>

                    {isReadOnly && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            This project is currently in a read-only state.
                        </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                            Close
                        </button>
                        {onEdit && (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                            >
                                <Edit2 size={16} />
                                Edit
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


