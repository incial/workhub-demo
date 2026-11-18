import { escapeCsvCell } from '../utils';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useToast } from '../context/ToastContext';
import { ALL_ZONES, VALID_ZONES } from '../context/ZoneContext';
import { useAuth } from '../context/AuthContext';
import { scopedUiKey } from '../demo/session';
import { useOperatorView } from '../context/OperatorViewContext';
import { activityApi, auditLogsApi, productionApi, reportsApi, schoolVisitApi, trackingApi, usersApi } from '../services/api';
import { AuditLogRow, ProductionEntry, ProjectTrackingReportRow, SchoolVisit, TrackingProjectLite, TrackingProjectRow, User, UserActivityStatement, UserTrackingData } from '../types';
import { Tabs } from '../components/ui/Tabs';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Factory, FileText, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { ActorHoverCard, HoveredActorCardState } from '../components/ui/ActorHoverCard';
import { formatRoleLabel as sharedRoleLabel } from '../utils/roleLabel';

type ProductionRow = {
    month: number;
    year: number;
    productId: number;
    category: string;
    productName: string;
    quantity: number;
    updatedBy?: HoveredActorCardState['actor'];
    updatedByShortName: string;
    updatedAt: string;
};

type InvoiceRow = {
    projectId: number;
    customerName: string;
    projectName: string;
    projectValue: number;
    invoiceAmount: number;
    amountReceived: number;
    pendingAmount: number;
    paymentStatus: TrackingPaymentStatus;
    nextDayFollowUp: string;
    lastContactDate: string;
    lastVisitDate: string;
    brc?: string;
    projectCategory?: string;
    projectType?: string;
    enquiryType?: string;
    needHelp?: string;
    salesOffice: boolean;
    salesHead: boolean;
    salesOfficeRemark?: string;
    accountsOwner?: HoveredActorCardState['actor'];
    accountsOwnerShortName: string;
};

type ProjectRow = {
    projectId: number;
    customerName: string;
    projectName: string;
    projectValue: number;
    invoiceAmount: number;
    pendingAmount: number;
    nextDayFollowUp: string;
    paymentStatus: TrackingPaymentStatus;
    lastContactDate: string;
    lastVisitDate: string;
    brc?: string;
    projectCategory?: string;
    projectType?: string;
    enquiryType?: string;
    needHelp?: string;
    salesOffice: boolean;
    salesHead: boolean;
    salesOfficeRemark?: string;
    stage: string;
    zone: string;
    completedDate: string;
    executiveOwner?: HoveredActorCardState['actor'];
    executiveOwnerShortName: string;
};

type TrackingPaymentStatus = 'Pending' | 'Partial' | 'Done' | 'Pending Input';
type TrackingTab = 'PROJECT_TRACKING' | 'USER_TRACKING' | 'PRODUCTION_TRACKING';
type TimeRangeOption = '1M' | '2M' | '3M' | '4M' | '5M' | '6M';
type UserTrackingRole = 'ROLE_EXECUTIVE' | 'ROLE_SALES_COORDINATOR' | 'ROLE_ACCOUNTS' | 'ROLE_INSTALLATION';
type ExecutiveExportPreset = TimeRangeOption | 'CUSTOM';
type ExecutiveCreationProject = TrackingProjectLite & { zone?: string };
// Match audit-log actor hover-card geometry for consistent tooltip behavior.
const ACTOR_CARD_WIDTH = 288;
const ACTOR_CARD_GAP = 8;
const ACTOR_CARD_SAFE_TOP = 220;
const ACTOR_CARD_VIEWPORT_PADDING = 8;
const COMPLETED_CARD_WIDTH = 240;
const USER_TRACKING_ROLES: UserTrackingRole[] = [
    'ROLE_EXECUTIVE',
    'ROLE_SALES_COORDINATOR',
    'ROLE_ACCOUNTS',
    'ROLE_INSTALLATION'
];
const USER_TRACKING_DIRECTORY_ROLES: string[] = [...USER_TRACKING_ROLES];
const PROJECT_TRACKING_PAGE_SIZE = 50;
const TIME_RANGE_OPTIONS: Array<{ value: TimeRangeOption; months: number; label: string; compactLabel: string }> = [
    { value: '1M', months: 1, label: 'Last 1 Month', compactLabel: '1M' },
    { value: '2M', months: 2, label: 'Last 2 Months', compactLabel: '2M' },
    { value: '3M', months: 3, label: 'Last 3 Months', compactLabel: '3M' },
    { value: '4M', months: 4, label: 'Last 4 Months', compactLabel: '4M' },
    { value: '5M', months: 5, label: 'Last 5 Months', compactLabel: '5M' },
    { value: '6M', months: 6, label: 'Last 6 Months', compactLabel: '6M' }
];
const USER_TRACKING_ROLE_OPTIONS: Array<{ value: UserTrackingRole; label: string; accent: string }> = [
    { value: 'ROLE_EXECUTIVE', label: 'Executive', accent: 'from-blue-600 to-cyan-600' },
    { value: 'ROLE_SALES_COORDINATOR', label: 'Sales', accent: 'from-indigo-600 to-blue-600' },
    { value: 'ROLE_ACCOUNTS', label: 'Accounts', accent: 'from-emerald-600 to-teal-600' },
    { value: 'ROLE_INSTALLATION', label: 'Installation', accent: 'from-orange-500 to-amber-600' }
];
const isUserInTrackingRole = (userOption: User, role: UserTrackingRole) => userOption.role === role;
const TRACKING_ROLE_STORAGE_KEY = 'tracking_role';
const TRACKING_USER_STORAGE_KEY = 'tracking_user';
const TRACKING_FILTERS_STORAGE_KEY = 'tracking_filters';

type TrackingFiltersStorage = {
    activeTab?: TrackingTab;
    timeRange?: TimeRangeOption;
    zone?: string;
};

const escapeCsv = escapeCsvCell;

const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<string | number>>) => {
    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map(row => row.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const toDateLabel = (date?: string) => date ? new Date(date).toLocaleDateString('en-GB') : '-';
const ADDITIONAL_PROJECT_DATA_CSV_HEADERS = [
    'Cluster',
    'Category',
    'Project Type',
    'Enquiry',
    'Last Contact',
    'Last Visit',
    'Need Help',
    'Sales Office',
    'Sales Head',
    'Sales Office Remark'
];
const PROJECT_TRACKING_CSV_HEADERS = [
    'No.',
    'Project ID',
    'Customer Name',
    'Project Name',
    'User',
    ...ADDITIONAL_PROJECT_DATA_CSV_HEADERS,
    'Next Follow-up',
    'Project Value',
    'Invoice Amount',
    'Pending Amount',
    'Payment Status',
    'Stage',
    'Zone'
];
const ADDITIONAL_PROJECT_DATA_LABELS: Record<string, string> = {
    STAR: 'Star',
    COMMON: 'Common',
    ART_AND_CRAFTS: 'Art and Crafts',
    SYSTEMATICS: 'Systematics',
    OUTDOOR: 'Outdoor',
    INDOOR: 'Indoor',
    FURNITURE: 'Furniture',
    LAB_ART_WORK: 'Lab Art Work',
    NO_ENQUIRIES: 'No Enquiries',
    NO_NEED: 'No Need',
    SALES_OFFICE: 'Sales Office',
    SALES_HEAD: 'Sales Head',
    MANAGEMENT: 'Management',
    OTHER_DEPARTMENTS: 'Other Departments',
    INFORMED_TO_SM: 'Informed to SM',
    INFORMED_TO_OPRN_DEP: 'Informed to OPRN DEP',
    INFORMED_TO_COO: 'Informed to COO',
    INFORMED_TO_MD: 'Informed to MD',
    GIVEN_ESTIMATION: 'Given Estimation',
    WORK_ORDER_RECEIVED: 'Work Order Received',
    DELIVERY_COMPLETED: 'Delivery Completed',
    INSTALLATION_COMPLETED: 'Installation Completed'
};
const formatAdditionalProjectDataValue = (value?: string) =>
    value ? ADDITIONAL_PROJECT_DATA_LABELS[value] || value : '';
type AdditionalProjectDataRow = {
    brc?: string;
    projectCategory?: string;
    projectType?: string;
    enquiryType?: string;
    lastContactDate?: string;
    lastVisitDate?: string;
    needHelp?: string;
    salesOffice?: boolean;
    salesHead?: boolean;
    salesOfficeRemark?: string;
};
const additionalProjectDataCsvValues = (row: AdditionalProjectDataRow) => [
    row.brc || '',
    formatAdditionalProjectDataValue(row.projectCategory),
    formatAdditionalProjectDataValue(row.projectType),
    formatAdditionalProjectDataValue(row.enquiryType),
    row.lastContactDate ? toDateLabel(row.lastContactDate) : '',
    row.lastVisitDate ? toDateLabel(row.lastVisitDate) : '',
    formatAdditionalProjectDataValue(row.needHelp),
    row.salesOffice ? 'TRUE' : 'FALSE',
    row.salesHead ? 'TRUE' : 'FALSE',
    formatAdditionalProjectDataValue(row.salesOfficeRemark)
];
const toDateTimeLabel = (date?: string) => {
    if (!date) return '-';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hour = String(parsed.getHours()).padStart(2, '0');
    const minute = String(parsed.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
};
const toCompletedAtLabel = (date?: string) => {
    if (!date) return '-';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(parsed).replace(',', ',');
};
const toShortName = (name?: string) => {
    if (!name) return '—';
    const trimmed = name.trim();
    if (!trimmed) return '—';
    return trimmed.split(/\s+/)[0];
};
const normalizeIdentifier = (value?: string) => (value || '').trim().toLowerCase();
const mapProjectPaymentStatusToLabel = (status?: string, pendingAmount?: number): TrackingPaymentStatus => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'PENDING_INPUT' || normalized === 'AWAITING_INVOICE' || normalized === 'NOT_GENERATED') {
        return 'Pending Input';
    }
    if (normalized === 'COMPLETED') return 'Done';
    if (normalized === 'PARTIAL') return 'Partial';
    if ((pendingAmount || 0) <= 0) return 'Done';
    return 'Pending';
};
const getPendingColorClass = (status: TrackingPaymentStatus) => {
    switch (status) {
        case 'Done':
            return 'text-green-700 bg-green-50';
        case 'Partial':
            return 'text-amber-700 bg-amber-50';
        case 'Pending Input':
            return 'text-slate-700 bg-slate-100';
        default:
            return 'text-red-700 bg-red-50';
    }
};
const getStatusBadgeClass = (status: TrackingPaymentStatus) => {
    switch (status) {
        case 'Done':
            return 'bg-green-100 text-green-700 border-green-200';
        case 'Partial':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Pending Input':
            return 'bg-slate-100 text-slate-700 border-slate-200';
        default:
            return 'bg-red-100 text-red-700 border-red-200';
    }
};
const EXECUTIVE_FOLLOW_UP_STAGES = new Set(['LEAD', 'ON_PROGRESS', 'QUOTATION_SENT', 'IN_REVIEW']);

type HoveredCompletedDateCardState = {
    completedDate: string;
    top: number;
    left: number;
    placement: 'top' | 'bottom';
};

type HoveredProjectCardState = {
    row: ProjectRow;
    top: number;
    left: number;
    placement: 'top' | 'bottom';
};
const getDateRangeFromOption = (range: TimeRangeOption) => {
    const to = new Date();
    const from = new Date();
    const option = TIME_RANGE_OPTIONS.find((entry) => entry.value === range) || TIME_RANGE_OPTIONS[0];
    from.setMonth(from.getMonth() - option.months);
    return {
        fromDate: from.toISOString().split('T')[0],
        toDate: to.toISOString().split('T')[0]
    };
};

const toIsoDayBoundary = (day: string, end = false) => `${day}T${end ? '23:59:59' : '00:00:00'}`;

const formatRoleLabel = (role?: string) => {
    if (!role) return 'N/A';
    return sharedRoleLabel(role);
};
const formatZoneLabel = (zone?: string) => {
    if (!zone) return 'N/A';
    if (zone === 'ALL_ZONES') return 'All Zones';
    return zone.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};
const formatActionLabel = (action: string) =>
    action
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
const getStatusPalette = (keyOrColor: string) => {
    const normalized = keyOrColor.toUpperCase();
    if (normalized.includes('RED')) {
        return { cardClass: 'border-red-100 bg-red-50', textClass: 'text-red-700' };
    }
    if (normalized.includes('YELLOW')) {
        return { cardClass: 'border-amber-100 bg-amber-50', textClass: 'text-amber-700' };
    }
    if (normalized.includes('GREEN')) {
        return { cardClass: 'border-emerald-100 bg-emerald-50', textClass: 'text-emerald-700' };
    }
    return { cardClass: 'border-slate-200 bg-slate-50', textClass: 'text-slate-700' };
};
const getExecutiveCardPalette = (key: string) => {
    switch (key) {
        case 'DUE':
            return { cardClass: 'border-red-100 bg-red-50', textClass: 'text-red-700' };
        case 'NON_ONBOARDED':
            return { cardClass: 'border-amber-100 bg-amber-50', textClass: 'text-amber-700' };
        case 'ONBOARDED':
            return { cardClass: 'border-emerald-100 bg-emerald-50', textClass: 'text-emerald-700' };
        default:
            return getStatusPalette(key);
    }
};

const getTimeRangeLabel = (range: TimeRangeOption) => {
    return TIME_RANGE_OPTIONS.find((entry) => entry.value === range)?.label || 'Last 1 Month';
};
const formatMonthYearLabel = (date: Date) =>
    date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const toDateKey = (value?: string) => {
    if (!value) return '';
    // Backend LocalDateTime values start with their business-calendar date.
    // Keep that date instead of converting it to UTC, which can move a project
    // created near midnight into the previous calendar cell.
    const serverDate = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (serverDate) return serverDate[1];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return toLocalDateKey(parsed);
};
type PipelineListModalState = {
    key: 'DUE' | 'NON_ONBOARDED' | 'ONBOARDED';
    label: string;
    rows: TrackingProjectLite[];
};
const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const isSameDay = (date: Date, compareTo: Date) =>
    date.getFullYear() === compareTo.getFullYear()
    && date.getMonth() === compareTo.getMonth()
    && date.getDate() === compareTo.getDate();
const buildCalendarDays = (monthCursor: Date) => {
    const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const monthStartWeekDay = (startOfMonth.getDay() + 6) % 7;
    const calendarStart = new Date(startOfMonth);
    calendarStart.setDate(startOfMonth.getDate() - monthStartWeekDay);

    return Array.from({ length: 42 }, (_, index) => {
        const day = new Date(calendarStart);
        day.setDate(calendarStart.getDate() + index);
        return day;
    });
};
const sortExecutivePipelineRows = (rows: TrackingProjectLite[], key: PipelineListModalState['key']) =>
    [...rows].sort((left, right) => {
        const leftDate = key === 'ONBOARDED'
            ? left.onboardedDate || left.stageEntryDate || ''
            : left.nextFollowupDate || left.stageEntryDate || '';
        const rightDate = key === 'ONBOARDED'
            ? right.onboardedDate || right.stageEntryDate || ''
            : right.nextFollowupDate || right.stageEntryDate || '';
        return rightDate.localeCompare(leftDate);
    });
const normalizeExecutiveCreationProjectRows = (rows: TrackingProjectRow[]): ExecutiveCreationProject[] =>
    rows
        .map((row) => ({
            id: row.id,
            name: row.projectName || row.school || `Project #${row.id}`,
            school: row.school,
            place: row.place,
            district: row.district,
            region: row.region,
            contactPerson: row.contactPerson,
            contactNumber: row.contactNumber,
            currentStage: row.currentStage,
            onboarded: row.onboarded,
            installationStatus: row.installationStatus,
            nextFollowupDate: row.dueDate,
            createdDate: row.createdDate || row.stageEntryDate,
            stageEntryDate: row.stageEntryDate,
            completedAt: row.completedAt,
            zone: row.zone,
            executiveRemarks: row.executiveRemarks,
            firstMeetingOutcome: row.firstMeetingOutcome
        }))
        .filter((project) => Boolean(toDateKey(project.createdDate)))
        .sort((a, b) => (b.createdDate || '').localeCompare(a.createdDate || ''));
const formatFeedbackLabel = (feedback?: string) => {
    if (feedback === 'POSITIVE') return 'Positive';
    if (feedback === 'NEGATIVE') return 'Negative';
    if (feedback === 'FIFTY_FIFTY') return '50-50';
    return '';
};
const getProjectsInDateRange = <T extends { createdDate?: string }>(projects: T[], from: string, to: string) =>
    projects.filter((project) => {
        const key = toDateKey(project.createdDate);
        return key && key >= from && key <= to;
    });
const getVisitsInDateRange = (visits: SchoolVisit[], from: string, to: string) =>
    visits.filter((visit) => {
        const key = toDateKey(visit.scheduledFor);
        return key && key >= from && key <= to;
    });
const safeFilePart = (value?: string) =>
    (value || 'report')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'report';
const isTrackingTab = (value: unknown): value is TrackingTab =>
    value === 'PROJECT_TRACKING' || value === 'USER_TRACKING' || value === 'PRODUCTION_TRACKING';
const isTimeRangeOption = (value: unknown): value is TimeRangeOption =>
    TIME_RANGE_OPTIONS.some((entry) => entry.value === value);
const isUserTrackingRole = (value: unknown): value is UserTrackingRole => USER_TRACKING_ROLES.includes(value as UserTrackingRole);
const isValidTrackingZone = (value: unknown): value is typeof ALL_ZONES | typeof VALID_ZONES[number] =>
    value === ALL_ZONES || VALID_ZONES.includes(value as typeof VALID_ZONES[number]);
const readStorageValue = (key: string) => {
    try {
        return localStorage.getItem(scopedUiKey(key));
    } catch {
        return null;
    }
};
const writeStorageValue = (key: string, value: string) => {
    try {
        localStorage.setItem(scopedUiKey(key), value);
    } catch {
        // ignore storage failures
    }
};
const removeStorageValue = (key: string) => {
    try {
        localStorage.removeItem(scopedUiKey(key));
    } catch {
        // ignore storage failures
    }
};
const readTrackingFilters = (): TrackingFiltersStorage => {
    const stored = readStorageValue(TRACKING_FILTERS_STORAGE_KEY);
    if (!stored) return {};
    try {
        const parsed = JSON.parse(stored) as TrackingFiltersStorage;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
};


export const ProjectTrackingPage: React.FC = () => {
    const { isSidebarCollapsed, showSidebar } = useLayout();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { effectiveRole } = useOperatorView();
    const isAdminTrackingUser =
        effectiveRole === 'ROLE_ADMIN' || effectiveRole === 'ROLE_SUPER_ADMIN' || effectiveRole === 'ROLE_OPERATOR';
    const canUseAllZones = effectiveRole === 'ROLE_ADMIN' || effectiveRole === 'ROLE_SUPER_ADMIN';
    const [trackingZone, setTrackingZone] = useState<typeof ALL_ZONES | typeof VALID_ZONES[number]>(() => {
        const storedZone = readTrackingFilters().zone;
        if (isValidTrackingZone(storedZone)) {
            return storedZone === ALL_ZONES && !canUseAllZones ? 'ZONE_1' : storedZone;
        }
        return canUseAllZones ? ALL_ZONES : 'ZONE_1';
    });
    const effectiveZone = trackingZone === ALL_ZONES ? undefined : trackingZone;
    const [activeTab, setActiveTab] = useState<TrackingTab>(() => {
        const storedTab = readTrackingFilters().activeTab;
        return isTrackingTab(storedTab) ? storedTab : 'PROJECT_TRACKING';
    });
    const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
    const [trackingRows, setTrackingRows] = useState<ProjectTrackingReportRow[]>([]);
    const [trackingPage, setTrackingPage] = useState(0);
    const [trackingTotalPages, setTrackingTotalPages] = useState(0);
    const [trackingTotalElements, setTrackingTotalElements] = useState(0);
    const [projectTrackingSearchOpen, setProjectTrackingSearchOpen] = useState(false);
    const [projectTrackingSearchInput, setProjectTrackingSearchInput] = useState('');
    const [projectTrackingSearchTerm, setProjectTrackingSearchTerm] = useState('');
    const [projectTrackingFilterOpen, setProjectTrackingFilterOpen] = useState(false);
    const [projectTrackingFromDateInput, setProjectTrackingFromDateInput] = useState('');
    const [projectTrackingToDateInput, setProjectTrackingToDateInput] = useState('');
    const [projectTrackingFromDate, setProjectTrackingFromDate] = useState('');
    const [projectTrackingToDate, setProjectTrackingToDate] = useState('');
    const [projectTrackingExporting, setProjectTrackingExporting] = useState(false);
    const [invoiceTrackingRows, setInvoiceTrackingRows] = useState<ProjectTrackingReportRow[]>([]);
    const [invoicePage, setInvoicePage] = useState(0);
    const [invoiceTotalPages, setInvoiceTotalPages] = useState(0);
    const [invoiceTotalElements, setInvoiceTotalElements] = useState(0);
    const [loading, setLoading] = useState(false);
    const [productionLoading, setProductionLoading] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRangeOption>(() => {
        const storedRange = readTrackingFilters().timeRange;
        return isTimeRangeOption(storedRange) ? storedRange : '1M';
    });
    const [fromDate, setFromDate] = useState(() => getDateRangeFromOption(isTimeRangeOption(readTrackingFilters().timeRange) ? readTrackingFilters().timeRange : '1M').fromDate);
    const [toDate, setToDate] = useState(() => getDateRangeFromOption(isTimeRangeOption(readTrackingFilters().timeRange) ? readTrackingFilters().timeRange : '1M').toDate);
    const [zoneUsers, setZoneUsers] = useState<User[]>([]);
    const [selectedUserRole, setSelectedUserRole] = useState<UserTrackingRole>(() => {
        const storedRole = readStorageValue(TRACKING_ROLE_STORAGE_KEY);
        return isUserTrackingRole(storedRole) ? storedRole : 'ROLE_EXECUTIVE';
    });
    const [selectedUserId, setSelectedUserId] = useState<number | undefined>(() => {
        const storedUserId = readStorageValue(TRACKING_USER_STORAGE_KEY);
        if (!storedUserId) return undefined;
        const parsed = Number(storedUserId);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    });
    const [userTrackingLoading, setUserTrackingLoading] = useState(false);
    const [userStatement, setUserStatement] = useState<UserActivityStatement | null>(null);
    const [userTrackingData, setUserTrackingData] = useState<UserTrackingData | null>(null);
    const [userTrackingRows, setUserTrackingRows] = useState<TrackingProjectRow[]>([]);
    // Calendar data is scoped to its visible six-week grid, independently of the report range.
    const [executiveCreationRows, setExecutiveCreationRows] = useState<TrackingProjectRow[]>([]);
    const [executiveVisitRows, setExecutiveVisitRows] = useState<SchoolVisit[]>([]);
    const [executiveRangeVisitRows, setExecutiveRangeVisitRows] = useState<SchoolVisit[]>([]);
    const [userLoginHistory, setUserLoginHistory] = useState<AuditLogRow[]>([]);
    const [hoveredActorCard, setHoveredActorCard] = useState<HoveredActorCardState | null>(null);
    const [hoveredCompletedDateCard, setHoveredCompletedDateCard] = useState<HoveredCompletedDateCardState | null>(null);
    const [hoveredProjectCard, setHoveredProjectCard] = useState<HoveredProjectCardState | null>(null);
    const [pipelineListModal, setPipelineListModal] = useState<PipelineListModalState | null>(null);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [selectedExecutiveCalendarDate, setSelectedExecutiveCalendarDate] = useState<Date>(() => new Date());
    const [executiveCalendarMonth, setExecutiveCalendarMonth] = useState<Date>(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const defaultExecutiveExportRange = getDateRangeFromOption('1M');
    const [executiveExportPreset, setExecutiveExportPreset] = useState<ExecutiveExportPreset>('1M');
    const [executiveExportFromDate, setExecutiveExportFromDate] = useState(defaultExecutiveExportRange.fromDate);
    const [executiveExportToDate, setExecutiveExportToDate] = useState(defaultExecutiveExportRange.toDate);
    const [executiveExportLoading, setExecutiveExportLoading] = useState(false);

    useEffect(() => {
        const storedZone = readTrackingFilters().zone;
        if (isValidTrackingZone(storedZone)) {
            const resolvedStoredZone = storedZone === ALL_ZONES && !canUseAllZones ? 'ZONE_1' : storedZone;
            setTrackingZone((previous) => previous === resolvedStoredZone ? previous : resolvedStoredZone);
            return;
        }
        setTrackingZone(canUseAllZones ? ALL_ZONES : 'ZONE_1');
    }, [canUseAllZones]);

    useEffect(() => {
        const range = getDateRangeFromOption(timeRange);
        setFromDate(range.fromDate);
        setToDate(range.toDate);
    }, [timeRange]);

    useEffect(() => {
        writeStorageValue(TRACKING_ROLE_STORAGE_KEY, selectedUserRole);
    }, [selectedUserRole]);

    useEffect(() => {
        if (selectedUserId) {
            writeStorageValue(TRACKING_USER_STORAGE_KEY, String(selectedUserId));
            return;
        }
        removeStorageValue(TRACKING_USER_STORAGE_KEY);
    }, [selectedUserId]);

    useEffect(() => {
        writeStorageValue(
            TRACKING_FILTERS_STORAGE_KEY,
            JSON.stringify({
                activeTab,
                timeRange,
                zone: trackingZone
            } satisfies TrackingFiltersStorage)
        );
    }, [activeTab, timeRange, trackingZone]);

    useEffect(() => {
        setPipelineListModal(null);
        if (activeTab !== 'USER_TRACKING') {
            setUserStatement(null);
            setUserTrackingData(null);
            setUserTrackingRows([]);
            setExecutiveCreationRows([]);
            setExecutiveVisitRows([]);
            setExecutiveRangeVisitRows([]);
            setUserLoginHistory([]);
        }
    }, [selectedUserRole, selectedUserId, activeTab]);

    useEffect(() => {
        if (selectedUserRole !== 'ROLE_EXECUTIVE') {
            return;
        }
        const today = new Date();
        setSelectedExecutiveCalendarDate(today);
        setExecutiveCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }, [selectedUserRole, selectedUserId]);

    useEffect(() => {
        if (activeTab === 'PROJECT_TRACKING') {
            setTrackingPage(0);
            setInvoicePage(0);
        }
    }, [activeTab, effectiveZone]);

    useEffect(() => {
        if (activeTab !== 'PROJECT_TRACKING') {
            setTrackingRows([]);
            setInvoiceTrackingRows([]);
            setTrackingTotalPages(0);
            setTrackingTotalElements(0);
            setInvoiceTotalPages(0);
            setInvoiceTotalElements(0);
            setLoading(false);
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                const [projectPage, invoicePageData] = await Promise.all([
                    reportsApi.getProjectTrackingPageData(
                        effectiveZone,
                        undefined,
                        trackingPage,
                        PROJECT_TRACKING_PAGE_SIZE,
                        projectTrackingSearchTerm || undefined,
                        projectTrackingFromDate || undefined,
                        projectTrackingToDate || undefined
                    ),
                    reportsApi.getProjectTrackingPageData(effectiveZone, 'ACCOUNTS', invoicePage, PROJECT_TRACKING_PAGE_SIZE)
                ]);
                if (cancelled) return;
                setTrackingRows(projectPage.content || []);
                setTrackingTotalPages(projectPage.totalPages || 0);
                setTrackingTotalElements(projectPage.totalElements || 0);
                setInvoiceTrackingRows(invoicePageData.content || []);
                setInvoiceTotalPages(invoicePageData.totalPages || 0);
                setInvoiceTotalElements(invoicePageData.totalElements || 0);
            } catch (error: any) {
                if (cancelled) return;
                showToast(error.message || 'Failed to load project tracking data', 'error');
                setTrackingRows([]);
                setInvoiceTrackingRows([]);
                setTrackingTotalPages(0);
                setTrackingTotalElements(0);
                setInvoiceTotalPages(0);
                setInvoiceTotalElements(0);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [
        activeTab,
        showToast,
        effectiveZone,
        trackingPage,
        invoicePage,
        projectTrackingSearchTerm,
        projectTrackingFromDate,
        projectTrackingToDate,
        refreshNonce
    ]);

    useEffect(() => {
        if (activeTab !== 'PRODUCTION_TRACKING') {
            setProductionEntries([]);
            setProductionLoading(false);
            return;
        }
        if (!fromDate || !toDate || fromDate > toDate) {
            setProductionEntries([]);
            setProductionLoading(false);
            return;
        }
        let cancelled = false;
        const loadProductionEntries = async () => {
            try {
                setProductionLoading(true);
                const entries = await productionApi.getHistory(
                    fromDate,
                    toDate,
                    effectiveZone,
                    1
                );
                if (!cancelled) {
                    setProductionEntries(entries || []);
                }
            } catch (error: any) {
                if (!cancelled) {
                    showToast(error.message || 'Failed to load production tracking entries', 'error');
                    setProductionEntries([]);
                }
            } finally {
                if (!cancelled) {
                    setProductionLoading(false);
                }
            }
        };
        loadProductionEntries();
        return () => {
            cancelled = true;
        };
    }, [activeTab, fromDate, toDate, effectiveZone, showToast, refreshNonce]);

    useEffect(() => {
        if (activeTab !== 'USER_TRACKING') {
            return;
        }
        const loadZoneUsers = async () => {
            if (!isAdminTrackingUser) {
                setZoneUsers([]);
                setSelectedUserId(undefined);
                return;
            }
            try {
                // The user selector must not inherit the report zone. Executives are
                // distributed across zones, while the other tracking roles use the
                // GLOBAL zone; passing effectiveZone silently hides both groups.
                const roleUsers = await usersApi.getDirectory(undefined, [...USER_TRACKING_ROLES]);
                const uniqueUsers = new Map<string | number, User>();
                roleUsers
                    .filter(u => USER_TRACKING_DIRECTORY_ROLES.includes(u.role))
                    .forEach((member) => {
                        uniqueUsers.set(member.id || member.email, member);
                    });
                const filteredUsers = Array.from(uniqueUsers.values())
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setZoneUsers(filteredUsers);
            } catch (error: any) {
                showToast(error.message || 'Failed to load users for tracking', 'error');
                setZoneUsers([]);
                setSelectedUserId(undefined);
            }
        };
        loadZoneUsers();
    }, [activeTab, isAdminTrackingUser, effectiveZone, showToast, refreshNonce]);

    const usersForSelectedRole = useMemo(
        () => zoneUsers.filter(userOption => isUserInTrackingRole(userOption, selectedUserRole)),
        [zoneUsers, selectedUserRole]
    );

    useEffect(() => {
        if (activeTab !== 'USER_TRACKING') {
            return;
        }
        setSelectedUserId((prev) => {
            if (prev && usersForSelectedRole.some(userOption => userOption.id === prev)) return prev;
            return usersForSelectedRole[0]?.id;
        });
    }, [activeTab, usersForSelectedRole]);

    useEffect(() => {
        let cancelled = false;
        const loadUserTrackingData = async () => {
            const requiresExecutiveUser = selectedUserRole === 'ROLE_EXECUTIVE';
            if (!isAdminTrackingUser || activeTab !== 'USER_TRACKING' || !fromDate || !toDate || fromDate > toDate || (requiresExecutiveUser && !selectedUserId)) {
                setUserStatement(null);
                setUserTrackingData(null);
                setUserTrackingRows([]);
                setExecutiveCreationRows([]);
                setExecutiveVisitRows([]);
                setExecutiveRangeVisitRows([]);
                setUserLoginHistory([]);
                return;
            }
            try {
                setUserTrackingLoading(true);
                const selectedUser = usersForSelectedRole.find(u => u.id === selectedUserId);
                if (requiresExecutiveUser && !selectedUser) {
                    setUserStatement(null);
                    setUserTrackingData(null);
                    setUserTrackingRows([]);
                    setExecutiveCreationRows([]);
                    setExecutiveVisitRows([]);
                    setExecutiveRangeVisitRows([]);
                    setUserLoginHistory([]);
                    return;
                }

                const fromBoundary = toIsoDayBoundary(fromDate);
                const toBoundary = toIsoDayBoundary(toDate, true);
                // The selector contains users from every zone. The tracking API
                // filters each result by the selected owner, so it must not inherit
                // the page's zone filter and hide that person's work elsewhere.
                const selectedUserDataZone = undefined;
                const statementRequest = selectedUserId
                    ? activityApi.getUserStatement(selectedUserId, fromBoundary, toBoundary).catch((error) => {
                        console.warn('User activity statement unavailable; continuing with tracking data.', error);
                        return {
                            userId: selectedUserId,
                            userName: selectedUser?.name || 'Selected User',
                            role: selectedUser?.role || selectedUserRole,
                            from: fromBoundary,
                            to: toBoundary,
                            totalActions: 0,
                            actionBreakdown: {},
                            roleContributions: {},
                            activityTimeline: []
                        } as UserActivityStatement;
                    })
                    : Promise.resolve(null);

                const executiveRangeVisitsRequest = selectedUserRole === 'ROLE_EXECUTIVE' && selectedUser?.email
                    ? schoolVisitApi.getForAssignee(selectedUser.email, fromDate, toDate).catch((error) => {
                        console.warn('Executive visit activity unavailable; continuing with project tracking data.', error);
                        return [] as SchoolVisit[];
                    })
                    : Promise.resolve([] as SchoolVisit[]);

                const [statement, userTrackingDetail, loginHistoryPage, executiveRangeVisits] = await Promise.all([
                    statementRequest,
                    trackingApi.getUserTrackingData({
                        role: selectedUserRole,
                        userId: selectedUserId,
                        zone: selectedUserDataZone,
                        from: fromBoundary,
                        to: toBoundary
                    }).catch((error) => {
                        console.warn('Detailed user tracking rows unavailable; continuing with summary data.', error);
                        return null;
                    }),
                    selectedUser?.email
                        ? auditLogsApi.getAuditLogs(fromDate, toDate, selectedUserDataZone, 'LOGIN', undefined, 1, 20, selectedUser.email)
                        : Promise.resolve({ content: [] } as any),
                    executiveRangeVisitsRequest
                ]);
                if (cancelled) return;
                setUserStatement(statement as UserActivityStatement | null);
                setUserTrackingData(userTrackingDetail);
                setUserTrackingRows(userTrackingDetail?.projectTableRows || []);
                setExecutiveRangeVisitRows(executiveRangeVisits);
                setUserLoginHistory(loginHistoryPage.content || []);
            } catch (error: any) {
                if (cancelled) return;
                showToast(error.message || 'Failed to load user tracking data', 'error');
                setUserStatement(null);
                setUserTrackingData(null);
                setUserTrackingRows([]);
                setExecutiveCreationRows([]);
                setExecutiveVisitRows([]);
                setExecutiveRangeVisitRows([]);
                setUserLoginHistory([]);
            } finally {
                if (!cancelled) {
                    setUserTrackingLoading(false);
                }
            }
        };
        loadUserTrackingData();
        return () => {
            cancelled = true;
        };
    }, [activeTab, isAdminTrackingUser, selectedUserId, selectedUserRole, fromDate, toDate, usersForSelectedRole, showToast, refreshNonce]);

    useEffect(() => {
        const selectedUser = usersForSelectedRole.find((userOption) => userOption.id === selectedUserId);
        if (
            !isAdminTrackingUser
            || activeTab !== 'USER_TRACKING'
            || selectedUserRole !== 'ROLE_EXECUTIVE'
            || !selectedUserId
            || !selectedUser?.email
        ) {
            setExecutiveCreationRows([]);
            setExecutiveVisitRows([]);
            return;
        }

        const visibleDays = buildCalendarDays(executiveCalendarMonth);
        const calendarFrom = toLocalDateKey(visibleDays[0]);
        const calendarTo = toLocalDateKey(visibleDays[visibleDays.length - 1]);
        let cancelled = false;
        const loadCalendarActivity = async () => {
            try {
                const [creationData, visits] = await Promise.all([
                    trackingApi.getUserTrackingData({
                        role: 'ROLE_EXECUTIVE',
                        userId: selectedUserId,
                        from: toIsoDayBoundary(calendarFrom),
                        to: toIsoDayBoundary(calendarTo, true)
                    }),
                    schoolVisitApi.getForAssignee(selectedUser.email, calendarFrom, calendarTo)
                ]);
                if (cancelled) return;
                setExecutiveCreationRows(creationData.projectTableRows || []);
                setExecutiveVisitRows(visits || []);
            } catch (error: any) {
                if (cancelled) return;
                showToast(error.message || 'Failed to load executive calendar activity', 'error');
                setExecutiveCreationRows([]);
                setExecutiveVisitRows([]);
            }
        };
        loadCalendarActivity();
        return () => {
            cancelled = true;
        };
    }, [activeTab, executiveCalendarMonth, isAdminTrackingUser, selectedUserId, selectedUserRole, usersForSelectedRole, showToast, refreshNonce]);

    const usersByEmail = useMemo(
        () => new Map(zoneUsers.map((entry) => [normalizeIdentifier(entry.email), entry])),
        [zoneUsers]
    );
    const usersByName = useMemo(
        () => new Map(zoneUsers.map((entry) => [normalizeIdentifier(entry.name), entry])),
        [zoneUsers]
    );
    const resolveTrackedUser = (identifier?: string, fallbackRole?: string): HoveredActorCardState['actor'] | undefined => {
        const normalized = normalizeIdentifier(identifier);
        if (!normalized) return undefined;
        const matched = usersByEmail.get(normalized) || usersByName.get(normalized);
        if (matched) {
            return {
                name: matched.name,
                email: matched.email,
                role: matched.role,
                zone: matched.zone,
                avatarUrl: matched.avatarUrl
            };
        }
        return {
            name: identifier || 'Unknown User',
            email: identifier || 'No email',
            role: fallbackRole,
            zone: effectiveZone || undefined
        };
    };
    const showActorCard = (event: React.MouseEvent<HTMLElement>, actor?: HoveredActorCardState['actor']) => {
        if (!actor) return;
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
    const showCompletedDateCard = (event: React.MouseEvent<HTMLElement>, completedDate?: string) => {
        if (!completedDate) return;
        const anchor = event.currentTarget.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const left = Math.min(
            Math.max(anchor.left, ACTOR_CARD_VIEWPORT_PADDING),
            Math.max(ACTOR_CARD_VIEWPORT_PADDING, viewportWidth - COMPLETED_CARD_WIDTH - ACTOR_CARD_VIEWPORT_PADDING)
        );
        const shouldRenderBelow = anchor.top < ACTOR_CARD_SAFE_TOP;
        const top = shouldRenderBelow ? anchor.bottom + ACTOR_CARD_GAP : anchor.top - ACTOR_CARD_GAP;
        setHoveredCompletedDateCard({
            completedDate,
            top,
            left,
            placement: shouldRenderBelow ? 'bottom' : 'top'
        });
    };
    const showProjectCard = (event: React.MouseEvent<HTMLElement>, row: ProjectRow) => {
        const anchor = event.currentTarget.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const left = Math.min(
            Math.max(anchor.left, ACTOR_CARD_VIEWPORT_PADDING),
            Math.max(ACTOR_CARD_VIEWPORT_PADDING, viewportWidth - ACTOR_CARD_WIDTH - ACTOR_CARD_VIEWPORT_PADDING)
        );
        const shouldRenderBelow = anchor.top < ACTOR_CARD_SAFE_TOP;
        const top = shouldRenderBelow ? anchor.bottom + ACTOR_CARD_GAP : anchor.top - ACTOR_CARD_GAP;
        setHoveredProjectCard({
            row,
            top,
            left,
            placement: shouldRenderBelow ? 'bottom' : 'top'
        });
    };
    const formatStageLabel = (stage?: string) => {
        if (!stage) return 'N/A';
        return stage.replace(/_/g, ' ');
    };

    const productionRows = useMemo<ProductionRow[]>(() => {
        return productionEntries
            .map((entry) => {
                const hasRowLevelUpdateAudit = Boolean(entry.updatedByEmail);
                const updatedBy = hasRowLevelUpdateAudit
                    ? {
                        name: entry.updatedByName || entry.updatedByEmail,
                        email: entry.updatedByEmail,
                        role: entry.updatedByRole,
                        zone: entry.updatedByZone,
                        avatarUrl: entry.updatedByAvatarUrl
                    }
                    : undefined;
                return {
                    month: entry.month,
                    year: entry.year,
                    productId: entry.productId,
                    category: entry.category || '-',
                    productName: entry.productName || '-',
                    quantity: entry.quantity || 0,
                    updatedBy,
                    updatedByShortName: hasRowLevelUpdateAudit ? toShortName(entry.updatedByName || entry.updatedByEmail) : '—',
                    updatedAt: hasRowLevelUpdateAudit ? (entry.timestamp || '') : ''
                };
            })
            .sort((a, b) => {
                const byYear = b.year - a.year;
                if (byYear !== 0) return byYear;
                const byMonth = b.month - a.month;
                if (byMonth !== 0) return byMonth;
                const byCategory = (a.category || '').localeCompare(b.category || '');
                if (byCategory !== 0) return byCategory;
                return (a.productName || '').localeCompare(b.productName || '');
            });
    }, [productionEntries]);

    const projectRows = useMemo<ProjectRow[]>(() => {
        return trackingRows
            .map(row => {
                const executiveOwner = row.executiveName || row.executiveEmail
                    ? {
                        name: row.executiveName || row.executiveEmail || 'Unknown Executive',
                        email: row.executiveEmail,
                        role: 'ROLE_EXECUTIVE',
                        zone: row.zone,
                        avatarUrl: row.executiveAvatarUrl
                    }
                    : undefined;
                const pendingAmount = (row.stage || '').toUpperCase() === 'SALES' && (row.invoiceAmount || 0) > 0
                    ? (row.invoiceAmount || 0)
                    : (row.pendingAmount || 0);
                return {
                    projectId: row.projectId,
                    customerName: row.customerName || '-',
                    projectName: row.projectName || '-',
                    projectValue: row.projectValue || 0,
                    invoiceAmount: row.invoiceAmount || 0,
                    pendingAmount,
                    nextDayFollowUp: row.nextDayFollowUp || '',
                    paymentStatus: mapProjectPaymentStatusToLabel(row.paymentStatus, pendingAmount),
                    lastContactDate: row.lastContactDate || '',
                    lastVisitDate: row.lastVisitDate || '',
                    brc: row.brc,
                    projectCategory: row.projectCategory,
                    projectType: row.projectType,
                    enquiryType: row.enquiryType,
                    needHelp: row.needHelp,
                    salesOffice: Boolean(row.salesOffice),
                    salesHead: Boolean(row.salesHead),
                    salesOfficeRemark: row.salesOfficeRemark,
                    stage: row.stage || 'UNKNOWN',
                    zone: row.zone || '-',
                    completedDate: row.completedDate || '',
                    executiveOwner,
                    executiveOwnerShortName: toShortName(executiveOwner?.name)
                };
            })
            .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    }, [trackingRows]);

    const invoiceRows = useMemo<InvoiceRow[]>(() => {
        return invoiceTrackingRows
            .map(project => {
                const accountsOwner = resolveTrackedUser(project.lastUpdatedBy || project.stageChangedBy, 'ROLE_ACCOUNTS');
                return {
                    projectId: project.projectId,
                    customerName: project.customerName || 'N/A',
                    projectName: project.projectName || project.customerName || 'N/A',
                    projectValue: project.projectValue || 0,
                    invoiceAmount: project.invoiceAmount || 0,
                    amountReceived: project.amountReceived || 0,
                    pendingAmount: project.pendingAmount || 0,
                    paymentStatus: mapProjectPaymentStatusToLabel(project.paymentStatus, project.pendingAmount),
                    nextDayFollowUp: project.nextDayFollowUp || '',
                    lastContactDate: project.lastContactDate || '',
                    lastVisitDate: project.lastVisitDate || '',
                    brc: project.brc,
                    projectCategory: project.projectCategory,
                    projectType: project.projectType,
                    enquiryType: project.enquiryType,
                    needHelp: project.needHelp,
                    salesOffice: Boolean(project.salesOffice),
                    salesHead: Boolean(project.salesHead),
                    salesOfficeRemark: project.salesOfficeRemark,
                    accountsOwner,
                    accountsOwnerShortName: toShortName(accountsOwner?.name)
                };
            })
            .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
    }, [invoiceTrackingRows, usersByEmail, usersByName, effectiveZone]);
    const totalPendingInProjects = useMemo(
        () => projectRows.reduce((sum, row) => sum + row.pendingAmount, 0),
        [projectRows]
    );
    const selectedTrackedUser = useMemo(
        () => usersForSelectedRole.find((entry) => entry.id === selectedUserId),
        [usersForSelectedRole, selectedUserId]
    );
    const selectedUserDisplay = useMemo(() => ({
        name: selectedTrackedUser?.name || 'N/A',
        email: selectedTrackedUser?.email || 'N/A',
        role: selectedTrackedUser?.role || 'N/A',
        zone: selectedTrackedUser?.zone || 'N/A'
    }), [selectedTrackedUser]);
    const trackingMetricValue = (label: string) =>
        userTrackingData?.box1Metrics?.find((metric) => metric.label === label)?.value || 0;
    const trackingProjectRows = useMemo<TrackingProjectLite[]>(() => (
        selectedUserRole === 'ROLE_EXECUTIVE'
            ? userTrackingRows.map((row) => ({
                id: row.id,
                name: row.projectName || row.school || `Project #${row.id}`,
                school: row.school,
                place: row.place,
                district: row.district,
                region: row.region,
                contactPerson: row.contactPerson,
                contactNumber: row.contactNumber,
                currentStage: row.currentStage,
                onboarded: row.onboarded,
                installationStatus: row.installationStatus,
                nextFollowupDate: row.dueDate,
                createdDate: row.createdDate,
                stageEntryDate: row.stageEntryDate,
                completedAt: row.completedAt,
                color: row.statusColor,
                executiveRemarks: row.executiveRemarks,
                firstMeetingOutcome: row.firstMeetingOutcome
            }))
            : []
    ), [selectedUserRole, userTrackingRows]);
    const userActionIndicators = useMemo(
        () => Object.entries(userStatement?.actionBreakdown || {})
            .map(([action, count]) => ({ action, count: Number(count) || 0 }))
            .filter((entry) => entry.action !== 'EXECUTIVE_STAGE_ADVANCED')
            .filter((entry) => entry.count > 0)
            .sort((a, b) => b.count - a.count),
        [userStatement]
    );
    const executiveProjectsOnboardedCount = trackingMetricValue('Onboarded Projects');
    const executiveSchoolsVisitedCount = useMemo(() => executiveRangeVisitRows.filter((visit) => {
        if (visit.status !== 'VISITED') return false;
        const visitDate = toDateKey(visit.outcomeRecordedAt || visit.scheduledFor);
        return Boolean(visitDate && visitDate >= fromDate && visitDate <= toDate);
    }).length, [executiveRangeVisitRows, fromDate, toDate]);
    const roleBasedBoxOneMetrics = useMemo(() => {
        const colorSets = [
            { valueClass: 'text-indigo-700', boxClass: 'bg-indigo-50 border-indigo-100', labelClass: 'text-indigo-600' },
            { valueClass: 'text-cyan-700', boxClass: 'bg-cyan-50 border-cyan-100', labelClass: 'text-cyan-600' },
            { valueClass: 'text-emerald-700', boxClass: 'bg-emerald-50 border-emerald-100', labelClass: 'text-emerald-600' },
            { valueClass: 'text-rose-700', boxClass: 'bg-rose-50 border-rose-100', labelClass: 'text-rose-600' }
        ];
        const metrics = selectedUserRole === 'ROLE_EXECUTIVE'
            ? [
                { label: 'Leads', value: trackingMetricValue('Leads (Not Onboarded)') },
                { label: 'Onboarded', value: trackingMetricValue('Onboarded Projects') },
                { label: 'Completed', value: trackingMetricValue('Completed Projects') },
                { label: 'Dropped', value: trackingMetricValue('Dropped Projects') }
            ]
            : [
                { label: 'Completed Projects', value: trackingMetricValue('Completed Projects') }
            ];
        return metrics.map((metric, index) => ({
            label: metric.label,
            value: metric.value,
            ...colorSets[index % colorSets.length]
        }));
    }, [selectedUserRole, userTrackingData]);
    const actionIndicators = useMemo(() => {
        if (selectedUserRole !== 'ROLE_EXECUTIVE') {
            return userActionIndicators;
        }
        const merged = new Map<string, number>();
        userActionIndicators.forEach((entry) => merged.set(entry.action, entry.count));
        merged.set('EXECUTIVE_PROJECTS_ONBOARDED', executiveProjectsOnboardedCount);
        merged.set('SITES_VISITED', executiveSchoolsVisitedCount);
        return Array.from(merged.entries())
            .map(([action, count]) => ({ action, count }))
            .filter((entry) => entry.count > 0)
            .sort((a, b) => b.count - a.count);
    }, [userActionIndicators, selectedUserRole, executiveProjectsOnboardedCount, executiveSchoolsVisitedCount]);
    const isExecutiveRoleTracking = selectedUserRole === 'ROLE_EXECUTIVE';
    const executiveStatusCards = useMemo(() => {
        const today = toLocalDateKey(new Date());
        const nonOnboarded = trackingProjectRows.filter((project) => !project.onboarded);
        const onboarded = trackingProjectRows.filter((project) => project.onboarded && project.currentStage !== 'DROPPED');
        return [
            { key: 'DUE' as const, label: 'Projects Due', rows: nonOnboarded.filter((project) => project.nextFollowupDate && project.nextFollowupDate <= today) },
            { key: 'NON_ONBOARDED' as const, label: 'Non-Onboarded Projects', rows: nonOnboarded },
            { key: 'ONBOARDED' as const, label: 'Onboarded Projects', rows: onboarded }
        ];
    }, [trackingProjectRows]);
    const completedProjectsCountForSelectedRole = trackingMetricValue('Completed Projects');
    const userProjectsSorted = useMemo(
        () => [...trackingProjectRows].sort((a, b) => (b.stageEntryDate || '').localeCompare(a.stageEntryDate || '')),
        [trackingProjectRows]
    );
    const executiveCreatedProjects = useMemo(
        () => normalizeExecutiveCreationProjectRows(executiveCreationRows),
        [executiveCreationRows]
    );
    const executiveCreatedProjectsByDate = useMemo(() => {
        const grouped = new Map<string, typeof executiveCreatedProjects>();
        executiveCreatedProjects.forEach((project) => {
            const key = toDateKey(project.createdDate);
            if (!key) return;
            const bucket = grouped.get(key) || [];
            bucket.push(project);
            grouped.set(key, bucket);
        });
        return grouped;
    }, [executiveCreatedProjects]);
    const executiveVisitsByDate = useMemo(() => {
        const grouped = new Map<string, SchoolVisit[]>();
        executiveVisitRows.forEach((visit) => {
            const key = toDateKey(visit.scheduledFor);
            if (!key) return;
            const bucket = grouped.get(key) || [];
            bucket.push(visit);
            grouped.set(key, bucket);
        });
        return grouped;
    }, [executiveVisitRows]);
    const selectedExecutiveDateKey = useMemo(
        () => toLocalDateKey(selectedExecutiveCalendarDate),
        [selectedExecutiveCalendarDate]
    );
    const executiveProjectsForSelectedDate = useMemo(
        () => executiveCreatedProjectsByDate.get(selectedExecutiveDateKey) || [],
        [executiveCreatedProjectsByDate, selectedExecutiveDateKey]
    );
    const executiveVisitsForSelectedDate = useMemo(
        () => executiveVisitsByDate.get(selectedExecutiveDateKey) || [],
        [executiveVisitsByDate, selectedExecutiveDateKey]
    );
    const executiveCalendarDays = useMemo(
        () => buildCalendarDays(executiveCalendarMonth),
        [executiveCalendarMonth]
    );
    const dateRangeFileSuffix = `${fromDate || 'from'}_to_${toDate || 'to'}`;
    const executiveExportPreviewCount = useMemo(
        () => getProjectsInDateRange(executiveCreatedProjects, executiveExportFromDate, executiveExportToDate).length
            + getVisitsInDateRange(executiveVisitRows, executiveExportFromDate, executiveExportToDate).length,
        [executiveCreatedProjects, executiveVisitRows, executiveExportFromDate, executiveExportToDate]
    );
    const executiveExportRangeInvalid = !executiveExportFromDate || !executiveExportToDate || executiveExportFromDate > executiveExportToDate;

    const applyExecutiveExportPreset = (range: TimeRangeOption) => {
        const nextRange = getDateRangeFromOption(range);
        setExecutiveExportPreset(range);
        setExecutiveExportFromDate(nextRange.fromDate);
        setExecutiveExportToDate(nextRange.toDate);
    };

    const buildExecutiveCreationExportRows = (
        projects: ExecutiveCreationProject[],
        visits: SchoolVisit[],
        rangeFrom = executiveExportFromDate,
        rangeTo = executiveExportToDate
    ) => {
        const visitedCount = visits.filter((visit) => visit.status === 'VISITED').length;
        const notVisitedCount = visits.filter((visit) => visit.status === 'NOT_VISITED').length;
        const scheduledCount = visits.filter((visit) => visit.status === 'SCHEDULED').length;
        const headers = ['', '', 'Executive Creation & Site Visit Activity Report'];
        const metadataRows = [
            [],
            [`Executive Name: ${selectedUserDisplay.name || 'N/A'}`],
            [`Executive Email: ${selectedUserDisplay.email || 'N/A'}`],
            [`Role: ${formatRoleLabel(selectedUserDisplay.role)}`],
            [`Zone: ${formatZoneLabel(effectiveZone || 'ALL_ZONES')}`],
            [`From Date: ${rangeFrom}`],
            [`To Date: ${rangeTo}`],
            [`Total Projects Created: ${projects.length}`],
            [`Total Site Visits: ${visits.length}`],
            [`Visited: ${visitedCount}`],
            [`Not Visited: ${notVisitedCount}`],
            [`Still Scheduled: ${scheduledCount}`],
            [],
            ['PROJECT CREATION DETAILS'],
            ['No.', 'Created At', 'Project Name', 'Customer Name', 'Place', 'District', 'Region', 'Contact Person', 'Contact Number', 'Current Stage', 'Zone', 'Onboarded', 'Executive Remark', 'Feedback']
        ];
        const projectRows = projects.map((project, idx) => [
            idx + 1,
            toDateTimeLabel(project.createdDate),
            project.name || 'N/A',
            project.school || 'N/A',
            project.place || 'N/A',
            project.district || 'N/A',
            project.region || 'N/A',
            project.contactPerson || 'N/A',
            project.contactNumber || 'N/A',
            project.currentStage || 'N/A',
            formatZoneLabel(project.zone),
            project.onboarded ? 'Yes' : 'No',
            project.executiveRemarks || '',
            formatFeedbackLabel(project.firstMeetingOutcome)
        ]);
        const visitRows = visits.map((visit, idx) => [
            idx + 1,
            toDateLabel(visit.scheduledFor),
            visit.school || 'N/A',
            visit.projectName || 'N/A',
            visit.status.replace(/_/g, ' '),
            visit.assignedTo || 'N/A',
            visit.scheduledBy || 'N/A',
            visit.executiveRemark || '',
            visit.visitNote || '',
            visit.notVisitedReason || '',
            toDateTimeLabel(visit.outcomeRecordedAt),
            visit.outcomeRecordedBy || ''
        ]);
        return {
            headers,
            rows: [
                ...metadataRows,
                ...projectRows,
                [],
                ['SITE VISIT DETAILS'],
                ['No.', 'Scheduled For', 'Customer Name', 'Project Name', 'Visit Status', 'Assigned To', 'Scheduled By', 'Executive Remark', 'Visit Note', 'Not Visited Reason', 'Outcome Recorded At', 'Outcome Recorded By'],
                ...visitRows
            ]
        };
    };

    const downloadExecutiveCreationRange = async () => {
        if (!selectedUserId || !selectedTrackedUser?.email) {
            showToast('Select an executive before exporting.', 'error');
            return;
        }
        if (executiveExportRangeInvalid) {
            showToast('Select a valid export date range.', 'error');
            return;
        }
        try {
            setExecutiveExportLoading(true);
            const [data, visits] = await Promise.all([
                trackingApi.getUserTrackingData({
                    role: 'ROLE_EXECUTIVE',
                    userId: selectedUserId,
                    zone: undefined,
                    from: toIsoDayBoundary(executiveExportFromDate),
                    to: toIsoDayBoundary(executiveExportToDate, true)
                }),
                schoolVisitApi.getForAssignee(selectedTrackedUser.email, executiveExportFromDate, executiveExportToDate)
            ]);
            const projects = normalizeExecutiveCreationProjectRows(data.projectTableRows || []);
            const { headers, rows } = buildExecutiveCreationExportRows(projects, visits);
            downloadCsv(
                `executive-creation-visit-activity-${safeFilePart(selectedUserDisplay.name)}-${executiveExportFromDate}_to_${executiveExportToDate}.csv`,
                headers,
                rows
            );
            showToast(`Exported ${projects.length} project${projects.length === 1 ? '' : 's'} and ${visits.length} visit${visits.length === 1 ? '' : 's'}.`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export executive creation and visit activity', 'error');
        } finally {
            setExecutiveExportLoading(false);
        }
    };

    const downloadDateRangeTotals = () => {
        const totals = {
            totalProjects: projectRows.length,
            totalItemsCreated: productionRows.reduce((sum, row) => sum + row.quantity, 0),
            totalProjectValue: projectRows.reduce((sum, p) => sum + (p.projectValue || 0), 0),
            totalInvoiceAmount: projectRows.reduce((sum, p) => sum + (p.invoiceAmount || 0), 0),
            totalAmountReceived: trackingRows.reduce((sum, p) => sum + (p.amountReceived || 0), 0),
            totalPendingAmount: projectRows.reduce((sum, p) => sum + (p.pendingAmount || 0), 0)
        };

        downloadCsv(
            `current-page-total-report-${dateRangeFileSuffix}-page-${trackingPage + 1}.csv`,
            ['Metric', 'Value'],
            [
                ['From Date', fromDate],
                ['To Date', toDate],
                ['Total Projects (Current Page)', totals.totalProjects],
                ['Total Items Created', totals.totalItemsCreated],
                ['Total Project Value', totals.totalProjectValue],
                ['Total Invoice Amount', totals.totalInvoiceAmount],
                ['Total Amount Received', totals.totalAmountReceived],
                ['Total Pending Amount', totals.totalPendingAmount]
            ]
        );
    };

    const projectTrackingDateRangeInvalid = Boolean(
        (projectTrackingFromDateInput || projectTrackingToDateInput)
        && (!projectTrackingFromDateInput
            || !projectTrackingToDateInput
            || projectTrackingFromDateInput > projectTrackingToDateInput)
    );
    const projectTrackingHasDateRange = Boolean(projectTrackingFromDate && projectTrackingToDate);

    const applyProjectTrackingSearch = () => {
        setProjectTrackingSearchTerm(projectTrackingSearchInput.trim());
        setTrackingPage(0);
    };

    const clearProjectTrackingSearch = () => {
        setProjectTrackingSearchInput('');
        setProjectTrackingSearchTerm('');
        setTrackingPage(0);
    };

    const applyProjectTrackingDateRange = () => {
        if (projectTrackingDateRangeInvalid) {
            showToast('Choose both creation dates, with From on or before To.', 'error');
            return;
        }
        setProjectTrackingFromDate(projectTrackingFromDateInput);
        setProjectTrackingToDate(projectTrackingToDateInput);
        setTrackingPage(0);
    };

    const clearProjectTrackingDateRange = () => {
        setProjectTrackingFromDateInput('');
        setProjectTrackingToDateInput('');
        setProjectTrackingFromDate('');
        setProjectTrackingToDate('');
        setTrackingPage(0);
    };

    const currentProjectTrackingCsvRows = projectRows.map((row, index) => [
        trackingPage * PROJECT_TRACKING_PAGE_SIZE + index + 1,
        row.projectId,
        row.customerName,
        row.projectName,
        row.executiveOwnerShortName,
        ...additionalProjectDataCsvValues(row),
        row.nextDayFollowUp ? toDateLabel(row.nextDayFollowUp) : '',
        row.projectValue,
        row.invoiceAmount,
        row.pendingAmount,
        row.paymentStatus,
        row.stage,
        row.zone
    ]);

    const downloadProjectTrackingCsv = async () => {
        if (!projectTrackingHasDateRange) {
            downloadCsv(
                `projects-current-page-${trackingPage + 1}.csv`,
                PROJECT_TRACKING_CSV_HEADERS,
                currentProjectTrackingCsvRows
            );
            return;
        }

        try {
            setProjectTrackingExporting(true);
            const rows = await reportsApi.getProjectTracking(
                toIsoDayBoundary(projectTrackingFromDate),
                toIsoDayBoundary(projectTrackingToDate, true),
                effectiveZone,
                undefined,
                projectTrackingSearchTerm || undefined
            );
            const exportRows = rows.map((row, index) => {
                const pendingAmount = (row.stage || '').toUpperCase() === 'SALES' && (row.invoiceAmount || 0) > 0
                    ? (row.invoiceAmount || 0)
                    : (row.pendingAmount || 0);
                return [
                    index + 1,
                    row.projectId,
                    row.customerName || '',
                    row.projectName || '',
                    toShortName(row.executiveName || row.executiveEmail),
                    ...additionalProjectDataCsvValues(row),
                    row.nextDayFollowUp ? toDateLabel(row.nextDayFollowUp) : '',
                    row.projectValue || 0,
                    row.invoiceAmount || 0,
                    pendingAmount,
                    mapProjectPaymentStatusToLabel(row.paymentStatus, pendingAmount),
                    row.stage || '',
                    row.zone || ''
                ];
            });
            downloadCsv(
                `projects-${projectTrackingFromDate}_to_${projectTrackingToDate}.csv`,
                PROJECT_TRACKING_CSV_HEADERS,
                exportRows
            );
            showToast(`Exported ${exportRows.length} project${exportRows.length === 1 ? '' : 's'} for the selected range.`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export project tracking data', 'error');
        } finally {
            setProjectTrackingExporting(false);
        }
    };

    const handleManualRefresh = () => {
        setRefreshNonce((prev) => prev + 1);
    };
    return (
        <>
            <div className="flex min-h-screen mesh-bg relative">
                <div className="glass-canvas" />
                <Sidebar />
                <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                    <Navbar />
                    <div className="px-4 lg:px-12 py-6 lg:py-10 pb-32 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">Project Tracking</h1>
                            <p className="text-gray-600 text-sm lg:text-base font-medium">
                                {activeTab === 'USER_TRACKING'
                                    ? 'Admin user-level tracking with role-based activity and project visibility.'
                                    : activeTab === 'PRODUCTION_TRACKING'
                                        ? 'Procurement updates with product-level quantity and updater visibility.'
                                        : 'Executive view for projects and invoices with date-range based downloads.'}
                            </p>
                        </div>
                        <div className="flex flex-col items-start lg:items-end gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={timeRange}
                                    onChange={(e) => setTimeRange(e.target.value as TimeRangeOption)}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-semibold text-gray-700"
                                >
                                    {TIME_RANGE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <div className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700">
                                    {fromDate} → {toDate}
                                </div>
                                <div className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-semibold text-gray-700">
                                    {formatZoneLabel(trackingZone)}
                                </div>
                                {activeTab === 'PROJECT_TRACKING' && (
                                    <button
                                        onClick={downloadDateRangeTotals}
                                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                                        disabled={!fromDate || !toDate || fromDate > toDate}
                                    >
                                        <Download size={15} />
                                        Download Current Page Totals
                                    </button>
                                )}
                            </div>
                            {fromDate > toDate && (
                                <p className="text-xs text-red-600 font-medium">From date must be on or before To date.</p>
                            )}
                        </div>
                    </div>

                    {activeTab === 'PROJECT_TRACKING' && loading && (
                        <div className="glass-panel rounded-2xl p-8 text-center text-gray-600 font-medium">Loading tracking data...</div>
                    )}

                    {isAdminTrackingUser && (
                        <Tabs
                            tabs={[
                                { id: 'PROJECT_TRACKING', label: 'Project Tracking' },
                                { id: 'USER_TRACKING', label: 'User Tracking' },
                                { id: 'PRODUCTION_TRACKING', label: 'Procurement Tracking' }
                            ]}
                            activeTab={activeTab}
                            onChange={(tabId) => setActiveTab(tabId as TrackingTab)}
                        />
                    )}

                    {activeTab === 'PROJECT_TRACKING' || activeTab === 'PRODUCTION_TRACKING' ? (
                    <div className="flex flex-col gap-6">
                    {activeTab === 'PROJECT_TRACKING' && (
                    <div className="order-2">
                    <TrackingSection
                        icon={<FileText className="text-brand-600" size={18} />}
                        title="Projects Tracking"
                        description="Tracks project lifecycle status and progress across stages."
                        onExport={downloadProjectTrackingCsv}
                        exporting={projectTrackingExporting}
                        headerActions={
                            <>
                                <button
                                    type="button"
                                    onClick={() => setProjectTrackingSearchOpen((open) => !open)}
                                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                                        projectTrackingSearchOpen || projectTrackingSearchTerm
                                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                                    }`}
                                    aria-expanded={projectTrackingSearchOpen}
                                >
                                    <Search size={15} />
                                    <span className="hidden sm:inline">Search</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProjectTrackingFilterOpen((open) => !open)}
                                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                                        projectTrackingFilterOpen || projectTrackingHasDateRange
                                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50'
                                    }`}
                                    aria-expanded={projectTrackingFilterOpen}
                                >
                                    <SlidersHorizontal size={15} />
                                    <span className="hidden sm:inline">Filter</span>
                                </button>
                            </>
                        }
                        controls={
                            <div className="space-y-3">
                                {projectTrackingSearchOpen && (
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            applyProjectTrackingSearch();
                                        }}
                                        className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-3 sm:flex-row sm:items-center"
                                    >
                                        <div className="relative min-w-0 flex-1">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={17} />
                                            <input
                                                type="search"
                                                autoFocus
                                                value={projectTrackingSearchInput}
                                                onChange={(event) => setProjectTrackingSearchInput(event.target.value)}
                                                placeholder="Search by customer name"
                                                className="w-full rounded-xl border border-blue-100 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 sm:flex-none">
                                                <Search size={15} />
                                                Search
                                            </button>
                                            {(projectTrackingSearchInput || projectTrackingSearchTerm) && (
                                                <button type="button" onClick={clearProjectTrackingSearch} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-600 transition hover:bg-slate-50" title="Clear customer search">
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                )}
                                {projectTrackingFilterOpen && (
                                    <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                                                <div>
                                                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Project created from</label>
                                                    <input
                                                        type="date"
                                                        value={projectTrackingFromDateInput}
                                                        onChange={(event) => setProjectTrackingFromDateInput(event.target.value)}
                                                        className="w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Project created to</label>
                                                    <input
                                                        type="date"
                                                        value={projectTrackingToDateInput}
                                                        onChange={(event) => setProjectTrackingToDateInput(event.target.value)}
                                                        className="w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button type="button" onClick={applyProjectTrackingDateRange} disabled={projectTrackingDateRangeInvalid} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                                                    <SlidersHorizontal size={15} />
                                                    Apply filter
                                                </button>
                                                {projectTrackingHasDateRange && (
                                                    <button type="button" onClick={clearProjectTrackingDateRange} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
                                                        Clear range
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-col gap-1 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                            <span>Apply a creation-date range, then download the CSV to export every matching project—not only this page.</span>
                                            {projectTrackingDateRangeInvalid && <span className="text-red-600">Choose both dates, with From on or before To.</span>}
                                        </div>
                                    </div>
                                )}
                                {(projectTrackingSearchTerm || projectTrackingHasDateRange) && (
                                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                                        <span>Active filters:</span>
                                        {projectTrackingSearchTerm && <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Customer: {projectTrackingSearchTerm}</span>}
                                        {projectTrackingHasDateRange && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">Created: {toDateLabel(projectTrackingFromDate)} – {toDateLabel(projectTrackingToDate)}</span>}
                                    </div>
                                )}
                            </div>
                        }
                    >
                        <SimpleTable tableClassName="min-w-[1800px]" headers={['No.', 'Customer', 'Project', 'User', 'Cluster', 'Category', 'Project Type', 'Enquiry', 'Last Contact', 'Last Visit', 'Next Follow-up', 'Need Help', 'Sales Office', 'Sales Office Remark', 'Project Value', 'Invoice Amount', 'Pending', 'Payment Status', 'Stage', 'Zone']}>
                            {loading && (
                                <tr>
                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={20}>Loading project tracking...</td>
                                </tr>
                            )}
                            {projectRows.map((row, index) => (
                                <tr key={`${row.projectId}-${row.customerName}-${row.projectName}`} className="border-t border-gray-100">
                                    <td className="px-3 py-2">{trackingPage * PROJECT_TRACKING_PAGE_SIZE + index + 1}</td>
                                    <td className="px-3 py-2">{row.customerName}</td>
                                    <td className="px-3 py-2">
                                        <span
                                            className="cursor-pointer"
                                            onMouseEnter={(event) => showProjectCard(event, row)}
                                            onMouseLeave={() => setHoveredProjectCard(null)}
                                        >
                                            {row.projectName}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.executiveOwner ? (
                                            <span
                                                className="inline-flex cursor-pointer font-semibold text-gray-900"
                                                onMouseEnter={(event) => showActorCard(event, row.executiveOwner)}
                                                onMouseLeave={() => setHoveredActorCard(null)}
                                            >
                                                {row.executiveOwnerShortName}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-3 py-2">{row.brc || '—'}</td>
                                    <td className="px-3 py-2">{formatAdditionalProjectDataValue(row.projectCategory) || '—'}</td>
                                    <td className="px-3 py-2">{formatAdditionalProjectDataValue(row.projectType) || '—'}</td>
                                    <td className="px-3 py-2">{formatAdditionalProjectDataValue(row.enquiryType) || '—'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{toDateLabel(row.lastContactDate)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{toDateLabel(row.lastVisitDate)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{toDateLabel(row.nextDayFollowUp)}</td>
                                    <td className="px-3 py-2">{formatAdditionalProjectDataValue(row.needHelp) || '—'}</td>
                                    <td className="px-3 py-2">{row.salesOffice ? 'Yes' : 'No'}</td>
                                    <td className="px-3 py-2">{formatAdditionalProjectDataValue(row.salesOfficeRemark) || '—'}</td>
                                    <td className="px-3 py-2">₹{row.projectValue.toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-2">₹{row.invoiceAmount.toLocaleString('en-IN')}</td>
                                    <td className={`px-3 py-2 font-semibold ${getPendingColorClass(row.paymentStatus)}`}>₹{row.pendingAmount.toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-bold ${getStatusBadgeClass(row.paymentStatus)}`}>
                                            {row.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.stage === 'COMPLETED' ? (
                                            <span
                                                className="inline-flex cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                                                onMouseEnter={(event) => showCompletedDateCard(event, row.completedDate)}
                                                onMouseLeave={() => setHoveredCompletedDateCard(null)}
                                            >
                                                {row.stage}
                                            </span>
                                        ) : row.stage}
                                    </td>
                                    <td className="px-3 py-2">{formatZoneLabel(row.zone)}</td>
                                </tr>
                            ))}
                            {!loading && projectRows.length === 0 && (
                                <tr>
                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={20}>No projects match the selected search and filters.</td>
                                </tr>
                            )}
                            <tr className="border-t-2 border-gray-300 bg-gray-50">
                                <td className="px-3 py-2 font-bold" colSpan={16}>Total Pending (Current Page)</td>
                                <td className="px-3 py-2 font-black text-red-700">₹{totalPendingInProjects.toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2" colSpan={3}></td>
                            </tr>
                        </SimpleTable>
                        <TrackingPagination
                            page={trackingPage}
                            totalPages={trackingTotalPages}
                            totalElements={trackingTotalElements}
                            onPageChange={setTrackingPage}
                        />
                    </TrackingSection>
                    </div>
                    )}

                    {activeTab === 'PRODUCTION_TRACKING' && (
                    <TrackingSection
                        icon={<Factory className="text-brand-600" size={18} />}
                        title="Procurement Tracking"
                        description={`Procurement updates from ${fromDate} to ${toDate}, with product-level updater traceability.`}
                        onExport={() => downloadCsv(
                            `production-${dateRangeFileSuffix}.csv`,
                            ['S.No', 'Month', 'Category', 'Product Name', 'Recorded Quantity', 'Last Updated By (User)', 'Last Updated Time'],
                            productionRows.map((r, idx) => [idx + 1, formatMonthYearLabel(new Date(r.year, r.month - 1, 1)), r.category, r.productName, r.quantity, r.updatedBy ? r.updatedByShortName : '—', r.updatedBy ? toDateTimeLabel(r.updatedAt) : '—'])
                        )}
                    >
                        <SimpleTable headers={['S.No', 'Month', 'Category', 'Product Name', 'Recorded Quantity', 'Last Updated By (User)', 'Last Updated Time']}>
                            {productionLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>Loading production tracking...</td>
                                </tr>
                            )}
                            {productionRows.map((row, index) => (
                                <tr key={`production-${row.year}-${row.month}-${row.productId}`} className="border-t border-gray-100">
                                    <td className="px-3 py-2">{index + 1}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{formatMonthYearLabel(new Date(row.year, row.month - 1, 1))}</td>
                                    <td className="px-3 py-2">{row.category}</td>
                                    <td className="px-3 py-2">{row.productName}</td>
                                    <td className="px-3 py-2 font-semibold">{row.quantity}</td>
                                    <td className="px-3 py-2">
                                        {row.updatedBy ? (
                                            <span
                                                className="inline-flex cursor-pointer font-semibold text-gray-900"
                                                onMouseEnter={(event) => showActorCard(event, row.updatedBy)}
                                                onMouseLeave={() => setHoveredActorCard(null)}
                                            >
                                                {row.updatedByShortName}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-500">{row.updatedBy ? toDateTimeLabel(row.updatedAt) : '—'}</td>
                                </tr>
                            ))}
                            {!productionLoading && productionRows.length === 0 && (
                                <tr>
                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>No production updates found for this date range.</td>
                                </tr>
                            )}
                        </SimpleTable>
                    </TrackingSection>
                    )}

                    {activeTab === 'PROJECT_TRACKING' && (
                    <div className="order-1">
                    <TrackingSection
                        icon={<FileText className="text-brand-600" size={18} />}
                        title="Invoice Visibility"
                        description="Tracks financial/payment status for projects currently in Accounts stage."
                        onExport={() => downloadCsv(
                            `invoices-${dateRangeFileSuffix}-page-${invoicePage + 1}.csv`,
                            ['No.', 'Project ID', 'Customer Name', 'Project Name', 'User', ...ADDITIONAL_PROJECT_DATA_CSV_HEADERS, 'Project Value', 'Invoice Amount', 'Pending Amount', 'Payment Status', 'Amount Received'],
                            invoiceRows.map((r, idx) => [
                                invoicePage * PROJECT_TRACKING_PAGE_SIZE + idx + 1,
                                r.projectId,
                                r.customerName,
                                r.projectName,
                                r.accountsOwnerShortName,
                                ...additionalProjectDataCsvValues(r),
                                r.projectValue,
                                r.invoiceAmount,
                                r.pendingAmount,
                                r.paymentStatus,
                                r.amountReceived
                            ])
                        )}
                    >
                        <SimpleTable headers={['No.', 'Customer', 'Project', 'User', 'Project Value', 'Invoice', 'Pending', 'Payment Status', 'Received']}>
                            {invoiceRows.map((row, index) => {
                                return (
                                    <tr key={`${row.projectId}-${row.customerName}-${row.projectName}`} className="border-t border-gray-100">
                                        <td className="px-3 py-2">{invoicePage * PROJECT_TRACKING_PAGE_SIZE + index + 1}</td>
                                        <td className="px-3 py-2">{row.customerName}</td>
                                        <td className="px-3 py-2">{row.projectName}</td>
                                        <td className="px-3 py-2">
                                            {row.accountsOwner ? (
                                                <span
                                                    className="inline-flex cursor-pointer font-semibold text-gray-900"
                                                    onMouseEnter={(event) => showActorCard(event, row.accountsOwner)}
                                                    onMouseLeave={() => setHoveredActorCard(null)}
                                                >
                                                    {row.accountsOwnerShortName}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-3 py-2">₹{row.projectValue.toLocaleString('en-IN')}</td>
                                        <td className="px-3 py-2">₹{row.invoiceAmount.toLocaleString('en-IN')}</td>
                                        <td className={`px-3 py-2 font-semibold ${getPendingColorClass(row.paymentStatus)}`}>₹{row.pendingAmount.toLocaleString('en-IN')}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-bold ${getStatusBadgeClass(row.paymentStatus)}`}>
                                                {row.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">₹{row.amountReceived.toLocaleString('en-IN')}</td>
                                    </tr>
                                );
                            })}
                        </SimpleTable>
                        <TrackingPagination
                            page={invoicePage}
                            totalPages={invoiceTotalPages}
                            totalElements={invoiceTotalElements}
                            onPageChange={setInvoicePage}
                        />
                    </TrackingSection>
                    </div>
                    )}

                    </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="glass-panel overflow-hidden rounded-[28px] border border-white/70 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)]">
                                <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-900 px-5 py-5 text-white lg:px-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-100">User Tracking Workspace</p>
                                            <h2 className="mt-2 text-2xl font-black tracking-tight">Employee activity and project ownership</h2>
                                        </div>
                                        <button
                                            onClick={handleManualRefresh}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 sm:w-auto"
                                            title="Refresh current tracking data"
                                        >
                                            <RefreshCw size={16} className={userTrackingLoading ? 'animate-spin' : ''} />
                                            Refresh Data
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-5 p-4 lg:p-6">
                                    <div>
                                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Role Focus</p>
                                                <p className="text-sm font-semibold text-slate-600">Pick which team workflow to inspect.</p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                                {formatZoneLabel(effectiveZone || 'ALL_ZONES')}
                                            </span>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            {USER_TRACKING_ROLE_OPTIONS.map((option) => {
                                                const selected = selectedUserRole === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setSelectedUserRole(option.value)}
                                                        className={`rounded-2xl border p-4 text-left transition-all ${
                                                            selected
                                                                ? `border-transparent bg-gradient-to-br ${option.accent} text-white shadow-[0_20px_45px_-28px_rgba(37,99,235,0.95)] ring-4 ring-blue-100`
                                                                : 'border-slate-200 bg-white/80 text-slate-700 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className={`text-sm font-black uppercase tracking-[0.16em] ${selected ? 'text-white' : 'text-slate-900'}`}>
                                                                {option.label}
                                                            </span>
                                                            <span className={`h-2.5 w-2.5 rounded-full ${selected ? 'bg-white' : 'bg-slate-300'}`} />
                                                        </div>
                                                        <p className={`mt-3 text-[11px] font-black uppercase tracking-[0.16em] ${selected ? 'text-white/80' : 'text-blue-600'}`}>
                                                            {zoneUsers.filter((entry) => isUserInTrackingRole(entry, option.value)).length} users
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                                        <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm">
                                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">Selected User</label>
                                            <select
                                                value={selectedUserId ?? ''}
                                                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : undefined)}
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                            >
                                                {usersForSelectedRole.length === 0 && <option value="">No users available for the selected role</option>}
                                                {usersForSelectedRole.map(userOption => (
                                                    <option key={userOption.id} value={userOption.id}>
                                                        {userOption.name} ({userOption.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 shadow-sm">
                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Active Profile</p>
                                            <p className="mt-2 text-lg font-black text-slate-950">{selectedUserDisplay.name}</p>
                                            <p className="mt-1 truncate text-xs font-semibold text-slate-600">{selectedUserDisplay.email}</p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <span className="rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
                                                    {formatRoleLabel(selectedUserDisplay.role)}
                                                </span>
                                                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
                                                    {formatZoneLabel(selectedUserDisplay.zone)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedUserRole === 'ROLE_EXECUTIVE' && !selectedUserId ? (
                                <div className="glass-panel rounded-2xl p-8 text-center text-gray-600 font-medium">Select a user to view employee report analytics.</div>
                            ) : userTrackingLoading ? (
                                <div className="glass-panel rounded-2xl p-8 text-center text-gray-600 font-medium">Loading user tracking data...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                        <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">User Summary</p>
                                            <p className="text-base font-black text-slate-900">{selectedUserDisplay.name}</p>
                                            <p className="text-xs font-semibold text-slate-600">{selectedUserDisplay.email}</p>
                                            <p className="text-xs text-slate-500 mt-1">{formatRoleLabel(selectedUserDisplay.role)} · {formatZoneLabel(selectedUserDisplay.zone)}</p>
                                            <div className={`mt-3 grid gap-2 text-center ${roleBasedBoxOneMetrics.length === 4 ? 'grid-cols-2' : roleBasedBoxOneMetrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                                {roleBasedBoxOneMetrics.map((metric) => (
                                                    <div key={metric.label} className={`rounded-lg border p-2 ${metric.boxClass}`}>
                                                        <p className={`text-[10px] font-bold uppercase ${metric.labelClass}`}>{metric.label}</p>
                                                        <p className={`text-lg font-black ${metric.valueClass}`}>{metric.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white/70 p-4">
                                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-3">
                                                {isExecutiveRoleTracking
                                                    ? 'Executive Pipeline View'
                                                    : 'Completed Project Summary'}
                                            </p>
                                            {isExecutiveRoleTracking ? (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {executiveStatusCards.map((card) => {
                                                        const cardKey = card.key as PipelineListModalState['key'];
                                                        const latestRows = sortExecutivePipelineRows(card.rows, cardKey).slice(0, 5);
                                                        const hasMoreRows = card.rows.length > latestRows.length;
                                                        return (
                                                        <div key={card.key} className={`rounded-lg border p-4 ${getExecutiveCardPalette(card.key).cardClass}`}>
                                                            <div className="text-center mb-3">
                                                                <p className={`text-[11px] font-bold uppercase ${getExecutiveCardPalette(card.key).textClass}`}>{card.label}</p>
                                                                <p className={`text-2xl font-black ${getExecutiveCardPalette(card.key).textClass}`}>{card.rows.length}</p>
                                                            </div>
                                                            {latestRows.length > 0 && (
                                                                <div className="overflow-x-auto bg-white/80 rounded-lg border border-white/70">
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-left text-gray-600 bg-gray-50">
                                                                                <th className="px-2 py-1.5 font-semibold">No.</th>
                                                                                <th className="px-2 py-1.5 font-semibold">Customer</th>
                                                                                <th className="px-2 py-1.5 font-semibold">Project</th>
                                                                                <th className="px-2 py-1.5 font-semibold">Stage</th>
                                                                                {card.key === 'ONBOARDED' ? (
                                                                                    <th className="px-2 py-1.5 font-semibold">Onboarded Date</th>
                                                                                ) : (
                                                                                    <th className="px-2 py-1.5 font-semibold">Next Follow-up</th>
                                                                                )}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {latestRows.map((project, index) => (
                                                                                <tr key={`${card.key}-${project.id}`} className="border-t border-gray-100">
                                                                                    <td className="px-2 py-1.5">{index + 1}</td>
                                                                                    <td className="px-2 py-1.5">{project.school || project.name || 'N/A'}</td>
                                                                                    <td className="px-2 py-1.5">{project.name || 'N/A'}</td>
                                                                                    <td className="px-2 py-1.5">{project.currentStage || 'N/A'}</td>
                                                                                    {card.key === 'ONBOARDED' ? (
                                                                                        <td className="px-2 py-1.5">{toDateTimeLabel(project.onboardedDate)}</td>
                                                                                    ) : (
                                                                                        <td className="px-2 py-1.5">{toDateLabel(project.nextFollowupDate)}</td>
                                                                                    )}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                            {hasMoreRows && (
                                                                <div className="mt-3 flex justify-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPipelineListModal({ key: cardKey, label: card.label, rows: sortExecutivePipelineRows(card.rows, cardKey).slice(5) })}
                                                                        className="rounded-md border border-current/30 bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase text-slate-700 transition-colors hover:bg-white"
                                                                    >
                                                                        View more ({card.rows.length - latestRows.length})
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                                                    <div className="text-center mb-3">
                                                        <p className="text-[11px] font-bold uppercase text-emerald-700">Completed Projects</p>
                                                        <p className="text-2xl font-black text-emerald-700">{completedProjectsCountForSelectedRole}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isExecutiveRoleTracking && (
                                        <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                                            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                                <div>
                                                    <h2 className="text-lg font-bold text-gray-900">Executive Creation & Visit Activity</h2>
                                                    <p className="text-sm font-medium text-slate-600">
                                                        Review project creations alongside scheduled, completed, and missed site visits for this executive.
                                                    </p>
                                                </div>
                                                <div className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                                                    <CalendarDays size={16} />
                                                    Selected Date: {selectedExecutiveCalendarDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>

                                            <div className="mb-5 rounded-[24px] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 shadow-sm">
                                                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">CSV Export Range</p>
                                                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                                                            {TIME_RANGE_OPTIONS.map((option) => {
                                                                const selected = executiveExportPreset === option.value;
                                                                return (
                                                                    <button
                                                                        key={option.value}
                                                                        type="button"
                                                                        onClick={() => applyExecutiveExportPreset(option.value)}
                                                                        className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                                                                            selected
                                                                                ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                                                                                : 'border-blue-100 bg-white/85 text-blue-700 hover:border-blue-300 hover:bg-blue-50'
                                                                        }`}
                                                                    >
                                                                        {option.compactLabel}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] xl:min-w-[560px]">
                                                        <div>
                                                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">From</label>
                                                            <input
                                                                type="date"
                                                                value={executiveExportFromDate}
                                                                onChange={(event) => {
                                                                    setExecutiveExportPreset('CUSTOM');
                                                                    setExecutiveExportFromDate(event.target.value);
                                                                }}
                                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">To</label>
                                                            <input
                                                                type="date"
                                                                value={executiveExportToDate}
                                                                onChange={(event) => {
                                                                    setExecutiveExportPreset('CUSTOM');
                                                                    setExecutiveExportToDate(event.target.value);
                                                                }}
                                                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={downloadExecutiveCreationRange}
                                                            disabled={executiveExportLoading || executiveExportRangeInvalid || !selectedUserId}
                                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_18px_35px_-24px_rgba(37,99,235,0.95)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:self-end"
                                                        >
                                                            <Download size={15} />
                                                            {executiveExportLoading ? 'Exporting...' : 'Export CSV'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-col gap-2 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                                    <span>
                                                        Preview in loaded window: {executiveExportPreviewCount} activity record{executiveExportPreviewCount === 1 ? '' : 's'}.
                                                    </span>
                                                    {executiveExportRangeInvalid && (
                                                        <span className="text-red-600">From date must be on or before To date.</span>
                                                    )}
                                                    {(executiveProjectsForSelectedDate.length > 0 || executiveVisitsForSelectedDate.length > 0) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const { headers, rows } = buildExecutiveCreationExportRows(
                                                                    executiveProjectsForSelectedDate,
                                                                    executiveVisitsForSelectedDate,
                                                                    selectedExecutiveDateKey,
                                                                    selectedExecutiveDateKey
                                                                );
                                                                downloadCsv(
                                                                    `executive-creation-visit-activity-${safeFilePart(selectedUserDisplay.name)}-${selectedExecutiveDateKey}.csv`,
                                                                    headers,
                                                                    rows
                                                                );
                                                            }}
                                                            className="text-left font-black uppercase tracking-[0.14em] text-blue-700 hover:text-blue-900 sm:text-right"
                                                        >
                                                            Export selected day
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)] xl:gap-5">
                                                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/80 p-3 shadow-sm sm:rounded-[28px] sm:p-5">
                                                    <div className="mb-4 flex items-center justify-between gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExecutiveCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:border-blue-200 hover:text-blue-700"
                                                            aria-label="Previous month"
                                                        >
                                                            <ChevronLeft size={18} />
                                                        </button>
                                                        <div className="text-center">
                                                            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Creation & Visit Calendar</p>
                                                            <p className="mt-1 text-lg font-black text-slate-900">{formatMonthYearLabel(executiveCalendarMonth)}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setExecutiveCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:border-blue-200 hover:text-blue-700"
                                                            aria-label="Next month"
                                                        >
                                                            <ChevronRight size={18} />
                                                        </button>
                                                    </div>
                                                    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 sm:mb-3 sm:gap-2 sm:text-[11px] sm:tracking-[0.18em]">
                                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                                            <div key={label} className="py-2">{label}</div>
                                                        ))}
                                                    </div>

                                                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                                        {executiveCalendarDays.map((day) => {
                                                            const dayKey = toLocalDateKey(day);
                                                            const projectsForDay = executiveCreatedProjectsByDate.get(dayKey) || [];
                                                            const visitsForDay = executiveVisitsByDate.get(dayKey) || [];
                                                            const projectCount = projectsForDay.length;
                                                            const visitCount = visitsForDay.length;
                                                            const totalActivityCount = projectCount + visitCount;
                                                            const isCurrentMonth = day.getMonth() === executiveCalendarMonth.getMonth();
                                                            const isSelected = dayKey === selectedExecutiveDateKey;
                                                            const isToday = isSameDay(day, new Date());

                                                            return (
                                                                <button
                                                                    key={dayKey}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedExecutiveCalendarDate(day);
                                                                        if (day.getMonth() !== executiveCalendarMonth.getMonth() || day.getFullYear() !== executiveCalendarMonth.getFullYear()) {
                                                                            setExecutiveCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                                                                        }
                                                                    }}
                                                                    className={`min-h-[68px] rounded-[18px] border p-2 text-left transition-all sm:min-h-[96px] sm:rounded-2xl ${
                                                                        isSelected
                                                                            ? 'border-blue-500 bg-blue-600 text-white shadow-[0_20px_35px_-22px_rgba(37,99,235,0.9)]'
                                                                            : isCurrentMonth
                                                                                ? 'border-slate-200 bg-white/90 text-slate-800 hover:border-blue-200 hover:bg-blue-50'
                                                                                : 'border-slate-100 bg-slate-50/70 text-slate-400 hover:border-slate-200'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <span className={`text-xs font-black sm:text-sm ${isSelected ? 'text-white' : isToday ? 'text-blue-700' : ''}`}>
                                                                            {day.getDate()}
                                                                        </span>
                                                                        {isToday && (
                                                                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                                                                Today
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="mt-3 sm:mt-4">
                                                                        <p className={`text-base font-black sm:text-lg ${
                                                                            isSelected
                                                                                ? 'text-white'
                                                                                : totalActivityCount > 0
                                                                                    ? 'text-slate-900'
                                                                                    : 'text-slate-400'
                                                                        }`}>
                                                                            {totalActivityCount || '-'}
                                                                        </p>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                                                    <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-3">
                                                        <div>
                                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Daily Summary</p>
                                                            <h3 className="mt-1 text-base sm:text-lg font-black text-slate-900">
                                                                {selectedExecutiveCalendarDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                            </h3>
                                                        </div>
                                                        <div className="flex w-full flex-wrap sm:w-auto items-center justify-end gap-3">
                                                            <div className="w-full sm:w-auto flex-shrink-0 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
                                                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Projects Created</p>
                                                                <p className="mt-1 text-2xl font-black text-emerald-700">{executiveProjectsForSelectedDate.length}</p>
                                                            </div>
                                                            <div className="w-full sm:w-auto flex-shrink-0 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center">
                                                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Site Visits</p>
                                                                <p className="mt-1 text-2xl font-black text-blue-700">{executiveVisitsForSelectedDate.length}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {executiveProjectsForSelectedDate.map((project, index) => (
                                                            <div key={`${selectedExecutiveDateKey}-${project.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
                                                                        {index + 1}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Project Name</p>
                                                                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{project.name || 'N/A'}</p>
                                                                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Customer Name</p>
                                                                        <p className="mt-1 truncate text-sm font-semibold text-slate-700">{project.school || 'N/A'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {executiveVisitsForSelectedDate.map((visit, index) => {
                                                            const visitStatus = visit.status === 'VISITED'
                                                                ? { label: 'Visited', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
                                                                : visit.status === 'NOT_VISITED'
                                                                    ? { label: 'Not visited', className: 'border-rose-200 bg-rose-50 text-rose-700' }
                                                                    : { label: 'Scheduled', className: 'border-amber-200 bg-amber-50 text-amber-700' };
                                                            return (
                                                                <div key={`visit-${visit.id}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                                                                            V{index + 1}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-sm font-bold text-slate-900">{visit.school}</p>
                                                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${visitStatus.className}`}>{visitStatus.label}</span>
                                                                            </div>
                                                                            <p className="mt-1 text-xs font-medium text-slate-600">{visit.projectName || 'Site visit'}</p>
                                                                            {visit.executiveRemark && (
                                                                                <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-xs text-violet-900">
                                                                                    <span className="font-black uppercase tracking-[0.12em] text-violet-700">Executive remark</span>
                                                                                    <p className="mt-1 leading-5">{visit.executiveRemark}</p>
                                                                                </div>
                                                                            )}
                                                                            {visit.status !== 'SCHEDULED' && (
                                                                                <p className="mt-2 text-xs text-slate-600">{visit.status === 'VISITED' ? visit.visitNote : visit.notVisitedReason}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {executiveProjectsForSelectedDate.length === 0 && executiveVisitsForSelectedDate.length === 0 && (
                                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm font-medium text-slate-500">
                                                                No projects were created or visits scheduled for this executive on the selected date.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                                        <h2 className="text-lg font-bold text-gray-900 mb-4">User Activity Indicators</h2>
                                        <SimpleTable headers={['No.', 'Action', 'Count']}>
                                            {actionIndicators.map((entry, index) => (
                                                <tr key={entry.action} className="border-t border-gray-100">
                                                    <td className="px-3 py-2">{index + 1}</td>
                                                    <td className="px-3 py-2 font-semibold text-gray-900">{formatActionLabel(entry.action)}</td>
                                                    <td className="px-3 py-2">{entry.count}</td>
                                                </tr>
                                            ))}
                                            {actionIndicators.length === 0 && (
                                                <tr>
                                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No activity indicators for selected user in this date range.</td>
                                                </tr>
                                            )}
                                        </SimpleTable>
                                    </div>

                                    <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                                        <h2 className="text-lg font-bold text-gray-900 mb-4">Login History</h2>
                                        <SimpleTable headers={['No.', 'Event', 'Timestamp']}>
                                            {userLoginHistory.map((log, index) => (
                                                <tr key={log.id} className="border-t border-gray-100">
                                                    <td className="px-3 py-2">{index + 1}</td>
                                                    <td className="px-3 py-2 font-semibold text-gray-900">{log.event || 'USER LOGIN'}</td>
                                                    <td className="px-3 py-2">{log.timestamp || '-'}</td>
                                                </tr>
                                            ))}
                                            {userLoginHistory.length === 0 && (
                                                <tr>
                                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No login history found for selected user in this date range.</td>
                                                </tr>
                                            )}
                                        </SimpleTable>
                                    </div>

                                    {isExecutiveRoleTracking && (
                                        <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                                            <h2 className="text-lg font-bold text-gray-900 mb-4">Detailed Project View</h2>
                                            <SimpleTable headers={['No.', 'Project', 'Stage', 'Color', 'Next Follow-up', 'Stage Entry Date']}>
                                                {userProjectsSorted.map((project, index) => (
                                                    <tr key={project.id} className="border-t border-gray-100">
                                                        <td className="px-3 py-2">{index + 1}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-semibold text-gray-900">{project.name || 'N/A'}</div>
                                                            <div className="text-xs text-gray-500">#{project.id} • {project.school}</div>
                                                        </td>
                                                        <td className="px-3 py-2">{project.currentStage || 'N/A'}</td>
                                                        <td className="px-3 py-2">{project.color || 'N/A'}</td>
                                                        <td className="px-3 py-2">{toDateLabel(project.nextFollowupDate)}</td>
                                                        <td className="px-3 py-2">{toDateLabel(project.stageEntryDate)}</td>
                                                    </tr>
                                                ))}
                                                {userProjectsSorted.length === 0 && (
                                                    <tr>
                                                        <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No projects found for selected role and time range.</td>
                                                    </tr>
                                                )}
                                            </SimpleTable>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            </div>
            {pipelineListModal && (
                <ExecutivePipelineListModal card={pipelineListModal} onClose={() => setPipelineListModal(null)} />
            )}
            <ActorHoverCard hoveredActorCard={hoveredActorCard} />
            <CompletedDateHoverCard hoveredCompletedDateCard={hoveredCompletedDateCard} />
            <ProjectTrackingHoverCard hoveredProjectCard={hoveredProjectCard} formatStageLabel={formatStageLabel} />
        </>
    );
};

const TrackingSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    description?: string;
    onExport: () => void | Promise<void>;
    exporting?: boolean;
    headerActions?: React.ReactNode;
    controls?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon, description, onExport, exporting = false, headerActions, controls, children }) => (
    <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    {icon}
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                </div>
                {description && <p className="text-xs text-gray-600 font-medium mt-1">{description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {headerActions}
                <button
                    onClick={onExport}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    <Download size={15} />
                    {exporting ? 'Exporting...' : 'Download CSV'}
                </button>
            </div>
        </div>
        {controls && <div className="mb-4">{controls}</div>}
        <div className="overflow-x-auto">{children}</div>
    </div>
);

const ExecutivePipelineListModal: React.FC<{
    card: PipelineListModalState;
    onClose: () => void;
}> = ({ card, onClose }) => (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Executive pipeline</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">{card.label}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-600">{card.rows.length} additional projects after the five shown in the pipeline view.</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Close</button>
            </div>
            <div className="overflow-auto p-5">
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                            <th className="px-3 py-3">No.</th>
                            <th className="px-3 py-3">Customer</th>
                            <th className="px-3 py-3">Project</th>
                            <th className="px-3 py-3">Stage</th>
                            <th className="px-3 py-3">{card.key === 'ONBOARDED' ? 'Onboarded Date' : 'Next Follow-up'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {card.rows.map((project, index) => (
                            <tr key={`${card.key}-${project.id}`} className="border-b border-slate-100 text-slate-700">
                                <td className="px-3 py-3 font-bold">{index + 1}</td>
                                <td className="px-3 py-3 font-semibold text-slate-900">{project.school || project.name || 'N/A'}</td>
                                <td className="px-3 py-3">{project.name || 'N/A'}</td>
                                <td className="px-3 py-3">{project.currentStage || 'N/A'}</td>
                                <td className="px-3 py-3">{card.key === 'ONBOARDED' ? toDateTimeLabel(project.onboardedDate) : toDateLabel(project.nextFollowupDate)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

const CompletedDateHoverCard: React.FC<{ hoveredCompletedDateCard: HoveredCompletedDateCardState | null }> = ({ hoveredCompletedDateCard }) => {
    if (!hoveredCompletedDateCard) return null;

    return createPortal(
        <div
            className="pointer-events-none fixed w-60 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-2xl ring-1 ring-emerald-100 backdrop-blur-sm"
            style={{
                top: hoveredCompletedDateCard.top,
                left: hoveredCompletedDateCard.left,
                zIndex: 1200,
                transform: hoveredCompletedDateCard.placement === 'top' ? 'translateY(-100%)' : undefined
            }}
        >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">Completed On</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{toCompletedAtLabel(hoveredCompletedDateCard.completedDate)}</p>
        </div>,
        document.body
    );
};

const ProjectTrackingHoverCard: React.FC<{
    hoveredProjectCard: HoveredProjectCardState | null;
    formatStageLabel: (stage?: string) => string;
}> = ({ hoveredProjectCard, formatStageLabel }) => {
    if (!hoveredProjectCard) return null;

    const { row } = hoveredProjectCard;
    const shouldShowExecutiveFollowUp = EXECUTIVE_FOLLOW_UP_STAGES.has((row.stage || '').toUpperCase());

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
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Project Detail</p>
            <div className="mt-3 space-y-3">
                <div>
                    <p className="text-lg font-bold text-slate-950 break-words">{row.projectName || `#${row.projectId}`}</p>
                    <p className="mt-1 text-sm text-slate-600 break-words">{row.customerName || 'No customer available'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Stage</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatStageLabel(row.stage)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Zone</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatZoneLabel(row.zone)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Invoice</p>
                        <p className="mt-1 font-semibold text-slate-900">₹{row.invoiceAmount.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pending</p>
                        <p className="mt-1 font-semibold text-slate-900">₹{row.pendingAmount.toLocaleString('en-IN')}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Payment Status</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{row.paymentStatus}</p>
                </div>
                {shouldShowExecutiveFollowUp && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next Follow-up</p>
                            <p className="mt-1 font-semibold text-slate-900">{toDateLabel(row.nextDayFollowUp)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Last Visit</p>
                            <p className="mt-1 font-semibold text-slate-900">{toDateLabel(row.lastVisitDate)}</p>
                        </div>
                    </div>
                )}
                <div className="text-xs text-slate-500">Project ID #{row.projectId}</div>
            </div>
        </div>,
        document.body
    );
};

const TrackingPagination: React.FC<{
    page: number;
    totalPages: number;
    totalElements: number;
    onPageChange: (page: number) => void;
}> = ({ page, totalPages, totalElements, onPageChange }) => {
    if (totalElements === 0) return null;
    const currentPage = Math.min(page, Math.max(0, totalPages - 1));
    return (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
            <span className="font-medium text-slate-600">
                Showing page {currentPage + 1} of {totalPages} ({totalElements.toLocaleString('en-IN')} records)
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <ChevronLeft size={16} /> Previous
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

const SimpleTable: React.FC<{ headers: string[]; children: React.ReactNode; tableClassName?: string }> = ({ headers, children, tableClassName = '' }) => (
    <table className={`w-full text-sm ${tableClassName}`}>
        <thead>
            <tr className="text-left text-gray-600 bg-gray-50">
                {headers.map(header => (
                    <th key={header} className="px-3 py-2 font-semibold">{header}</th>
                ))}
            </tr>
        </thead>
        <tbody>{children}</tbody>
    </table>
);
