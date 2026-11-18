import { escapeCsvCell } from '../utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useZone } from '../context/ZoneContext';
import { useOperatorView } from '../context/OperatorViewContext';
import { Tabs } from '../components/ui/Tabs';
import { CompletedProjectMetrics, Project } from '../types';
import { projectApi } from '../services/api';
import { Search, CheckCircle, Building2, MapPin, Calendar, DollarSign, Clock, Filter, ChevronDown, ExternalLink, Phone, User, Briefcase, Landmark, Wallet, Receipt, Wrench, FileText, Milestone, ShieldCheck, Layers3, ArrowUpRight, TrendingUp, Download } from 'lucide-react';
import { KERALA_DISTRICTS } from '../constants/kerala-districts';
import { PARENT_COMPANY_OPTIONS } from '../constants/dropdown-options';
import { formatRoleLabel as sharedRoleLabel } from '../utils/roleLabel';

const parseInstallationItems = (installationTaskList?: string): string[] => {
    return (installationTaskList || '')
        .split(/[\n,，،]+/)
        .map(item => item.trim())
        .filter(Boolean);
};

const formatFirstMeetingOutcome = (outcome?: string): string => {
    if (!outcome) return 'N/A';
    if (outcome === 'FIFTY_FIFTY') return '50-50';
    return outcome.replace(/_/g, ' ');
};

const formatRoleLabel = (role?: string): string => {
    if (!role) return 'N/A';
    return sharedRoleLabel(role);
};

const formatZoneLabel = (zone?: string): string => {
    if (!zone) return 'N/A';
    return zone.replace(/_/g, ' ');
};

const formatDateDDMMYYYY = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

const formatDateLong = (value?: string) => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
};

const formatStageLabel = (value?: string) => {
    if (!value) return 'N/A';
    return value.replace(/_/g, ' ');
};

const formatFeedbackLabel = (value?: boolean) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Pending';
};

const getHistoryChipClass = (value?: string) => {
    if (!value) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (value === 'COMPLETED' || value === 'WORK_DONE') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (value === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (value === 'PARTIAL' || value === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (value === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (value === 'PENDING_INPUT') return 'bg-slate-100 text-slate-700 border-slate-200';
    if (value === 'NOT_DONE') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
};

const splitParentCompanies = (value?: string) =>
    (value || '')
        .split(',')
        .map((company) => company.trim())
        .filter(Boolean);

const archiveStatusLabel = (project: Project) => {
    if (project.currentStage === 'DROPPED' || project.deletionRequestStatus === 'APPROVED') return 'Dropped Project';
    if (project.deletionRequestStatus === 'PENDING') return 'Deletion Requested';
    if (project.deletionRequestStatus === 'REJECTED') return 'Deletion Rejected';
    return 'Completed Project';
};

const archiveStatusBadgeClass = (project: Project) => {
    if (project.currentStage === 'DROPPED' || project.deletionRequestStatus === 'APPROVED') {
        return 'border-rose-200 bg-rose-100 text-rose-700';
    }
    if (project.deletionRequestStatus === 'PENDING') {
        return 'border-amber-200 bg-amber-100 text-amber-700';
    }
    if (project.deletionRequestStatus === 'REJECTED') {
        return 'border-red-200 bg-red-100 text-red-700';
    }
    return 'border-emerald-200 bg-emerald-100 text-emerald-700';
};

const csvEscape = escapeCsvCell;

const downloadCsvFile = (filename: string, rows: unknown[][]) => {
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const safeFilenamePart = (value?: string) =>
    (value || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'project';

const calculateProjectDurationDays = (project: Project): number | null => {
    const durationEndDate = project.stageChangeTimestamp || project.completionDate;
    if (!project.createdDate || !durationEndDate) return null;
    const start = new Date(project.createdDate);
    const end = new Date(durationEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 0);
};

const getResolvedReceivedAmount = (project: Project) =>
    project.totalReceived ?? project.amountReceived ?? project.totalPaidAmount ?? 0;

const getResolvedPendingAmount = (project: Project) =>
    project.pendingAmount ?? Math.max((project.invoiceAmount ?? 0) - getResolvedReceivedAmount(project), 0);

const buildProjectJourneyCsvRows = (project: Project): unknown[][] => {
    const paymentHistory = [...(project.paymentHistory || [])].sort(
        (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    );
    const installationItems = parseInstallationItems(project.installationTaskList);
    const parentCompanies = splitParentCompanies(project.parentCompany);
    const resolvedProjectValue = project.projectValue ?? project.invoiceAmount ?? 0;
    const resolvedReceivedAmount = getResolvedReceivedAmount(project);
    const resolvedPendingAmount = getResolvedPendingAmount(project);
    const durationDays = calculateProjectDurationDays(project);
    const feedbackStatusLabel = formatFeedbackLabel(project.feedbackCollected);
    const isSameDaySalesToAccounts = Boolean(project.salesCompletedAt && project.accountsEntryDate)
        && new Date(project.salesCompletedAt!).toDateString() === new Date(project.accountsEntryDate!).toDateString();
    let runningRemaining = project.invoiceAmount ?? 0;

    const journeyRows = [
        ['Project Journey', 'Executive Lead Created', formatDateLong(project.createdDate), 'Project was first registered in the executive pipeline.', `Created by ${project.createdBy || 'executive user'}. Executive remarks: ${project.executiveRemarks || 'No remarks captured.'}`],
        ['Project Journey', 'Onboarded', formatDateLong(project.salesEntryDate || project.accountsEntryDate || project.installationEntryDate || project.completionDate), 'Project moved beyond executive follow-up and entered the internal workflow.', project.firstMeetingOutcome ? `Meeting result: ${formatFirstMeetingOutcome(project.firstMeetingOutcome)}` : 'Meeting result was not captured.'],
        ['Project Journey', 'Sales Ready for Accounts', formatDateLong(project.salesCompletedAt || project.accountsEntryDate), 'Sales completed quotation and invoice handoff for accounts.', isSameDaySalesToAccounts ? `Invoice amount: ${project.invoiceAmount ?? 0}. This handoff and accounts acceptance were recorded on the same day.` : `Invoice amount: ${project.invoiceAmount ?? 0}`],
        ['Project Journey', 'Accounts Accepted', formatDateLong(project.accountsEntryDate), 'Accounts started finance handling for the project.', `Payment status: ${formatStageLabel(project.paymentStatus)}`],
        ...paymentHistory.map((payment, index) => {
            runningRemaining = Math.max(runningRemaining - (payment.amountPaid ?? 0), 0);
            return [
                'Project Journey',
                paymentHistory.length === 1 ? 'Payment Recorded' : `Partial Payment ${index + 1}`,
                formatDateLong(payment.paymentDate),
                `${payment.amountPaid ?? 0} recorded by ${payment.createdBy || 'Accounts user'}.`,
                `${payment.remarks ? `Remarks: ${payment.remarks}. ` : ''}Remaining after this payment: ${runningRemaining}`
            ];
        }),
        ['Project Journey', 'Accounts Cleared for Installation', formatDateLong(project.accountsCompletedAt || project.installationEntryDate), 'Accounts completed its work and handed the project to installation.', `Pending amount at handoff: ${resolvedPendingAmount}`],
        ['Project Journey', 'Installation Started', formatDateLong(project.installationEntryDate), 'Installation team received the project and began execution planning.', installationItems.length > 0 ? `${installationItems.length} installation task(s) recorded.` : 'No installation task list was recorded.'],
        ['Project Journey', 'Work Marked Done', formatDateLong(project.installationCompletedAt || project.completionDate), 'Installation team marked the work as done.', `Installation status: ${formatStageLabel(project.installationStatus)}. Marked by ${project.installationUserEmail || project.lastUpdatedBy || 'installation user'}.`],
        ['Project Journey', 'Project Completed', formatDateLong(project.completionDate), 'Project was closed and moved into the completed archive.', `Final received amount: ${resolvedReceivedAmount}`],
        project.feedbackUpdatedAt
            ? ['Project Journey', 'Customer Feedback Updated', formatDateLong(project.feedbackUpdatedAt), `Feedback was marked ${feedbackStatusLabel.toUpperCase()} by ${project.feedbackUpdatedBy || 'feedback user'}.`, 'This completed project has been reviewed by the feedback team.']
            : null,
        project.deletionRequestedAt
            ? ['Project Journey', 'Deletion Request Raised', formatDateLong(project.deletionRequestedAt), `Deletion request was raised from ${formatStageLabel(project.deletionRequestedFromStage || project.currentStage)} by ${project.deletionRequestedBy || 'Unknown user'} (${formatRoleLabel(project.deletionRequestedByRole)}).`, `Reason: ${project.deletionRequestReason || 'No reason captured.'}`]
            : null,
        project.deletionRequestStatus === 'APPROVED' && project.deletionReviewedAt
            ? ['Project Journey', 'Deletion Request Approved', formatDateLong(project.deletionReviewedAt), `Deletion request was approved by ${project.deletionReviewedBy || 'Unknown user'} (${formatRoleLabel(project.deletionReviewedByRole)}).`, `Approval remarks: ${project.deletionReviewRemarks || 'No approval remarks captured.'}`]
            : null,
        project.deletionRequestStatus === 'REJECTED' && project.deletionReviewedAt
            ? ['Project Journey', 'Deletion Request Rejected', formatDateLong(project.deletionReviewedAt), `Deletion request was rejected by ${project.deletionReviewedBy || 'Unknown user'} (${formatRoleLabel(project.deletionReviewedByRole)}).`, `Rejection remarks: ${project.deletionReviewRemarks || 'No rejection remarks captured.'}`]
            : null
    ].filter(Boolean);

    const detailRows = [
        ['Project Snapshot', 'Project ID', project.id, '', ''],
        ['Project Snapshot', 'Customer', project.school, '', ''],
        ['Project Snapshot', 'Project Name', project.projectName || 'Not provided', '', ''],
        ['Project Snapshot', 'Contact Person', project.contactPerson || 'Not provided', '', ''],
        ['Project Snapshot', 'Contact Number', project.contactNumber || 'Not provided', '', ''],
        ['Project Snapshot', 'Place', project.place || 'Not provided', '', ''],
        ['Project Snapshot', 'District', project.district || 'Not provided', '', ''],
        ['Project Snapshot', 'Zone', formatZoneLabel(project.zone), '', ''],
        ['Project Snapshot', 'Parent Companies', parentCompanies.length > 0 ? parentCompanies.join(' | ') : 'Not provided', '', ''],
        ['Project Snapshot', 'Created By', project.createdBy || 'Not provided', '', ''],
        ['Project Snapshot', 'Current Stage', formatStageLabel(project.currentStage), '', ''],
        ['Project Snapshot', 'Installation Classification', project.projectClassification || 'Not recorded', '', ''],
        ['Executive Add Data', 'Cluster', project.brc || 'Not recorded', '', ''],
        ['Executive Add Data', 'Category', formatStageLabel(project.projectCategory), '', ''],
        ['Executive Add Data', 'Project Type', formatStageLabel(project.projectType), '', ''],
        ['Executive Add Data', 'Enquiry', formatStageLabel(project.enquiryType), '', ''],
        ['Executive Add Data', 'Last Visit', formatDateLong(project.lastVisitDate), '', ''],
        ['Executive Add Data', 'Need Help', formatStageLabel(project.needHelp), '', ''],
        ['Executive Add Data', 'Sales Office', project.salesOffice ? 'TRUE' : 'FALSE', '', ''],
        ['Executive Add Data', 'Sales Head', project.salesHead ? 'TRUE' : 'FALSE', '', ''],
        ['Executive Add Data', 'Sales Office Remark', formatStageLabel(project.salesOfficeRemark), '', ''],
        ['Executive Add Data', 'Payment', formatStageLabel(project.paymentStatus), '', ''],
        ['Finance Summary', 'Project Value', resolvedProjectValue, '', ''],
        ['Finance Summary', 'Invoice Amount', project.invoiceAmount ?? 0, '', ''],
        ['Finance Summary', 'Total Received', resolvedReceivedAmount, '', ''],
        ['Finance Summary', 'Pending Amount', resolvedPendingAmount, '', ''],
        ['Finance Summary', 'Payment Status', formatStageLabel(project.paymentStatus), '', ''],
        ['Delivery Notes', 'Expected Delivery', formatDateLong(project.expectedDeliveryDate), '', ''],
        ['Delivery Notes', 'Extra Work Needed', project.isExtraWorkNeeded ? 'Yes' : 'No', '', ''],
        ['Delivery Notes', 'Installation Status', formatStageLabel(project.installationStatus), '', ''],
        ['Delivery Notes', 'Installation Task List', installationItems.length > 0 ? installationItems.join(' | ') : 'Not recorded', '', ''],
        ['Feedback', 'Feedback Status', feedbackStatusLabel, '', ''],
        ['Feedback', 'Feedback Updated By', project.feedbackUpdatedBy || 'Not recorded', formatDateLong(project.feedbackUpdatedAt), ''],
        ['Dates', 'Created', formatDateLong(project.createdDate), '', ''],
        ['Dates', 'Sales Entered', formatDateLong(project.salesEntryDate), '', ''],
        ['Dates', 'Sales Completed', formatDateLong(project.salesCompletedAt), '', ''],
        ['Dates', 'Accounts Entered', formatDateLong(project.accountsEntryDate), '', ''],
        ['Dates', 'Accounts Completed', formatDateLong(project.accountsCompletedAt), '', ''],
        ['Dates', 'Installation Entered', formatDateLong(project.installationEntryDate), '', ''],
        ['Dates', 'Installation Marked Done', formatDateLong(project.installationCompletedAt), '', ''],
        ['Dates', 'Completed', formatDateLong(project.completionDate), '', ''],
        ['Dates', 'Project Duration', durationDays != null ? `${durationDays} days` : 'Not recorded', '', ''],
        ['Remarks', 'First Meeting Feedback', project.firstMeetingOutcome ? formatFirstMeetingOutcome(project.firstMeetingOutcome) : 'Not recorded', '', ''],
        ['Remarks', 'Executive Remarks', project.executiveRemarks || 'Not recorded', '', ''],
        ['Remarks', 'Quotation Remarks', project.quotationRemarks || 'Not recorded', '', ''],
        ['Remarks', 'Sales Remarks', project.salesRemarks || 'Not recorded', '', ''],
        ['Remarks', 'Payment Remarks', project.paymentRemarks || 'Not recorded', '', ''],
        ['Remarks', 'Installation Remarks', project.installationRemarks || 'Not recorded', '', '']
    ];

    return [
        ['WorkHub Completed Project Journey Export'],
        ['Generated At', new Date().toLocaleString('en-IN')],
        ['Project', project.school || project.projectName || `Project ${project.id}`],
        [],
        ['Section', 'Field / Event', 'Value / Date', 'Detail', 'Notes'],
        ...detailRows,
        [],
        ['Section', 'Field / Event', 'Value / Date', 'Detail', 'Notes'],
        ...journeyRows
    ];
};

const buildCompletedArchiveCsvRows = (projects: Project[], months: number): unknown[][] => {
    const totalValue = projects.reduce((sum, project) => sum + (project.projectValue ?? project.invoiceAmount ?? 0), 0);
    const totalReceived = projects.reduce((sum, project) => sum + getResolvedReceivedAmount(project), 0);
    return [
        ['WorkHub Completed Projects Archive Export'],
        ['Generated At', new Date().toLocaleString('en-IN')],
        ['Period', `Last ${months} month${months === 1 ? '' : 's'}`],
        ['Total Projects', projects.length],
        ['Total Project Value', totalValue],
        ['Total Received', totalReceived],
        [],
        [
            'Project ID',
            'Customer',
            'Project Name',
            'Zone',
            'Parent Companies',
            'Contact Person',
            'Contact Number',
            'Place',
            'District',
            'Project Value',
            'Invoice Amount',
            'Amount Received',
            'Pending Amount',
            'Payment Status',
            'Installation Status',
            'Installation Classification',
            'Created Date',
            'Completed Date',
            'Project Duration Days',
            'Created By',
            'Feedback Status',
            'Feedback Updated At'
        ],
        ...projects.map((project) => [
            project.id,
            project.school,
            project.projectName || 'Not provided',
            formatZoneLabel(project.zone),
            splitParentCompanies(project.parentCompany).join(' | ') || 'Not provided',
            project.contactPerson || 'Not provided',
            project.contactNumber || 'Not provided',
            project.place || 'Not provided',
            project.district || 'Not provided',
            project.projectValue ?? project.invoiceAmount ?? 0,
            project.invoiceAmount ?? 0,
            getResolvedReceivedAmount(project),
            getResolvedPendingAmount(project),
            formatStageLabel(project.paymentStatus),
            formatStageLabel(project.installationStatus),
            project.projectClassification || 'Not recorded',
            formatDateLong(project.createdDate),
            formatDateLong(project.completionDate),
            calculateProjectDurationDays(project) ?? 'Not recorded',
            project.createdBy || 'Not provided',
            formatFeedbackLabel(project.feedbackCollected),
            formatDateLong(project.feedbackUpdatedAt)
        ])
    ];
};

const getArchiveCardTone = (project: Project) => {
    if (project.currentStage === 'DROPPED' || project.deletionRequestStatus === 'APPROVED') {
        return {
            shell: 'bg-white border-rose-200/80',
            accent: 'bg-rose-500',
            metric: 'bg-rose-50 border-rose-100 text-rose-950'
        };
    }
    if (project.deletionRequestStatus === 'PENDING') {
        return {
            shell: 'bg-white border-amber-200/80',
            accent: 'bg-amber-500',
            metric: 'bg-amber-50 border-amber-100 text-amber-950'
        };
    }
    return {
        shell: 'bg-white border-slate-200/80',
        accent: 'bg-emerald-500',
        metric: 'bg-slate-50 border-slate-200 text-slate-950'
    };
};

export const WorkCompletedPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { isSidebarCollapsed, showSidebar } = useLayout();
    const { effectiveZone } = useZone();
    const { effectiveRole } = useOperatorView();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
    const [archiveTab, setArchiveTab] = useState<'completed' | 'requests' | 'dropped'>('completed');
    const [tabCounts, setTabCounts] = useState({ completed: 0, requests: 0, dropped: 0 });
    const [showFilters, setShowFilters] = useState(false);
    const [reviewTarget, setReviewTarget] = useState<{ projectId: number; approve: boolean; school: string } | null>(null);
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [filters, setFilters] = useState({
        district: '',
        parentCompany: ''
    });
    const [exportMonths, setExportMonths] = useState(1);
    const [archiveExporting, setArchiveExporting] = useState(false);
    const [completedPage, setCompletedPage] = useState(1);
    const [completedTotalPages, setCompletedTotalPages] = useState(1);
    const [completedTotalElements, setCompletedTotalElements] = useState(0);
    const [completedMetrics, setCompletedMetrics] = useState<CompletedProjectMetrics | null>(null);
    const tabLoadingRef = useRef<Record<'completed' | 'requests' | 'dropped', boolean>>({
        completed: false,
        requests: false,
        dropped: false
    });
    const tabLoadedRef = useRef<Record<'completed' | 'requests' | 'dropped', boolean>>({
        completed: false,
        requests: false,
        dropped: false
    });
    const tabFailedRef = useRef<Record<'completed' | 'requests' | 'dropped', boolean>>({
        completed: false,
        requests: false,
        dropped: false
    });
    const badgeCountsLoadedRef = useRef(false);
    const completedPageSize = 10;
    const archiveRole = effectiveRole || user?.role;
    const isArchiveAdmin = archiveRole === 'ROLE_ADMIN' || archiveRole === 'ROLE_SUPER_ADMIN' || archiveRole === 'ROLE_OPERATOR';

    const loadCompletedMetrics = useCallback(async () => {
        if (!isArchiveAdmin) {
            setCompletedMetrics(null);
            return;
        }
        try {
            const metrics = await projectApi.getCompletedProjectMetrics(effectiveZone);
            setCompletedMetrics(metrics);
        } catch (error: any) {
            showToast(error.message || 'Failed to load completed project metrics', 'error');
        }
    }, [effectiveZone, isArchiveAdmin, showToast]);

    const loadProjects = useCallback(async (tab: 'completed' | 'requests' | 'dropped', page = 1, force = false) => {
        if (tabLoadingRef.current[tab] || ((tabLoadedRef.current[tab] || tabFailedRef.current[tab]) && !force)) {
            return;
        }
        try {
            if (force) {
                tabFailedRef.current = { ...tabFailedRef.current, [tab]: false };
            }
            tabLoadingRef.current = { ...tabLoadingRef.current, [tab]: true };
            setLoading(true);
            if (tab === 'completed') {
                const data = await projectApi.getCompletedProjects(page, completedPageSize, effectiveZone);
                setProjects(data.content || []);
                setCompletedPage((data.number ?? 0) + 1);
                setCompletedTotalPages(data.totalPages || 1);
                setCompletedTotalElements(data.totalElements || 0);
                if (!isArchiveAdmin) {
                    setTabCounts({
                        completed: data.totalElements || 0,
                        requests: 0,
                        dropped: 0
                    });
                }
                tabFailedRef.current = { ...tabFailedRef.current, completed: false };
                tabLoadedRef.current = { ...tabLoadedRef.current, completed: true };
                return;
            }

            const data = tab === 'requests'
                    ? await projectApi.getProjectDeletionRequests()
                    : await projectApi.getDroppedProjects();
            setProjects(data);
            setCompletedPage(1);
            setCompletedTotalPages(1);
            setCompletedTotalElements(0);
            if (!isArchiveAdmin) {
                setTabCounts({
                    completed: 0,
                    requests: 0,
                    dropped: 0
                });
            }
            tabFailedRef.current = { ...tabFailedRef.current, [tab]: false };
            tabLoadedRef.current = { ...tabLoadedRef.current, [tab]: true };
        } catch (error: any) {
            tabFailedRef.current = { ...tabFailedRef.current, [tab]: true };
            tabLoadedRef.current = { ...tabLoadedRef.current, [tab]: false };
            showToast(error.message || 'Failed to load archive projects', 'error');
        } finally {
            tabLoadingRef.current = { ...tabLoadingRef.current, [tab]: false };
            setLoading(false);
        }
    }, [completedPageSize, effectiveZone, isArchiveAdmin, showToast]);

    const loadArchiveBadgeCounts = useCallback(async (force = false) => {
        if (badgeCountsLoadedRef.current && !force) {
            return;
        }
        try {
            const counts = await projectApi.getCompletedArchiveBadgeCounts(effectiveZone);
            setTabCounts({
                completed: counts.completed || 0,
                requests: counts.requests || 0,
                dropped: counts.dropped || 0
            });
            badgeCountsLoadedRef.current = true;
        } catch (error: any) {
            showToast(error.message || 'Failed to load archive counts', 'error');
        }
    }, [effectiveZone, showToast]);

    useEffect(() => {
        setArchiveTab('completed');
        setProjects([]);
        setSearchTerm('');
        setAppliedSearchTerm('');
        setFilters({
            district: '',
            parentCompany: ''
        });
        setCompletedPage(1);
        setCompletedTotalPages(1);
        setCompletedTotalElements(0);
        setTabCounts({ completed: 0, requests: 0, dropped: 0 });
        tabLoadingRef.current = { completed: false, requests: false, dropped: false };
        tabLoadedRef.current = { completed: false, requests: false, dropped: false };
        tabFailedRef.current = { completed: false, requests: false, dropped: false };
        badgeCountsLoadedRef.current = false;
        void loadArchiveBadgeCounts();
        void loadProjects('completed', 1);
    }, [effectiveZone, user?.role, loadArchiveBadgeCounts, loadProjects]);

    useEffect(() => {
        if (archiveTab === 'completed') {
            void loadCompletedMetrics();
        }
    }, [archiveTab, loadCompletedMetrics]);

    useEffect(() => {
        if (!tabLoadedRef.current[archiveTab] && !tabLoadingRef.current[archiveTab] && !tabFailedRef.current[archiveTab]) {
            void loadProjects(archiveTab, 1);
        }
    }, [archiveTab, loadProjects]);

    const loadCompletedProjectsGlobal = async (
        search = appliedSearchTerm,
        nextFilters = filters,
        page = 1
    ) => {
        try {
            setLoading(true);
            const data = await projectApi.getCompletedProjectsArchiveFiltered(
                effectiveZone,
                search,
                nextFilters.district,
                nextFilters.parentCompany,
                page,
                completedPageSize
            );
            setProjects(data.content || []);
            setCompletedPage((data.number ?? 0) + 1);
            setCompletedTotalPages(data.totalPages || 1);
            setCompletedTotalElements(data.totalElements || 0);
        } catch (error: any) {
            showToast(error.message || 'Failed to load filtered completed projects', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCompletedSearch = async () => {
        if (archiveTab !== 'completed') {
            return;
        }
        const normalizedSearch = searchTerm.trim();
        setAppliedSearchTerm(normalizedSearch);
        const hasActiveFilters = Boolean(normalizedSearch || filters.district || filters.parentCompany);

        if (hasActiveFilters) {
            await loadCompletedProjectsGlobal(normalizedSearch, filters, 1);
            return;
        }

        void loadProjects('completed', 1, true);
    };

    const handleClearFilters = async () => {
        const resetFilters = {
            district: '',
            parentCompany: ''
        };

        setSearchTerm('');
        setAppliedSearchTerm('');
        setFilters(resetFilters);

        if (archiveTab === 'completed') {
            await loadProjects('completed', 1, true);
        }
    };

    const openReviewDeletionRequest = (projectId: number, approve: boolean, school: string) => {
        setReviewRemarks('');
        setReviewTarget({ projectId, approve, school });
    };

    const handleReviewDeletionRequest = async () => {
        if (!reviewTarget) return;
        try {
            setReviewSubmitting(true);
            await projectApi.reviewProjectDeletionRequest(reviewTarget.projectId, {
                approve: reviewTarget.approve,
                remarks: reviewRemarks.trim() || undefined
            });
            showToast(reviewTarget.approve ? 'Deletion request approved' : 'Deletion request rejected', 'success');
            setReviewTarget(null);
            tabLoadedRef.current = { ...tabLoadedRef.current, [archiveTab]: false };
            void loadProjects(archiveTab, archiveTab === 'completed' ? completedPage : 1, true);
            void loadArchiveBadgeCounts(true);
        } catch (error: any) {
            showToast(error.message || 'Failed to review deletion request', 'error');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleExportCompletedArchiveCsv = async () => {
        if (archiveTab !== 'completed') return;
        try {
            setArchiveExporting(true);
            const exportProjects = await projectApi.exportCompletedProjectsArchive(
                exportMonths,
                effectiveZone,
                appliedSearchTerm,
                filters.district,
                filters.parentCompany
            );
            const sortedProjects = (exportProjects || [])
                .sort((a, b) => new Date(b.completionDate || b.stageChangeTimestamp || b.createdDate).getTime() - new Date(a.completionDate || a.stageChangeTimestamp || a.createdDate).getTime());

            if (sortedProjects.length === 0) {
                showToast(`No completed projects found in the last ${exportMonths} month${exportMonths === 1 ? '' : 's'}`, 'info');
                return;
            }

            downloadCsvFile(
                `completed-projects-last-${exportMonths}-month${exportMonths === 1 ? '' : 's'}.csv`,
                buildCompletedArchiveCsvRows(sortedProjects, exportMonths)
            );
            showToast(`Exported ${sortedProjects.length} completed project${sortedProjects.length === 1 ? '' : 's'}`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export completed projects CSV', 'error');
        } finally {
            setArchiveExporting(false);
        }
    };

    const filteredAndSortedProjects = React.useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        let filtered = [...projects];
        if (archiveTab !== 'completed') {
            filtered = projects.filter(p => {
                const matchesSearch =
                    (p.school || '').toLowerCase().includes(lowerSearchTerm) ||
                    (p.contactPerson || '').toLowerCase().includes(lowerSearchTerm) ||
                    (p.contactNumber || '').includes(searchTerm);

                const matchesDistrict = !filters.district || p.district === filters.district;
                const matchesCompany = !filters.parentCompany || p.parentCompany === filters.parentCompany;

                return matchesSearch && matchesDistrict && matchesCompany;
            });
        }

        filtered.sort((a, b) => {
            const dateA = new Date(a.completionDate || a.stageChangeTimestamp || a.createdDate).getTime();
            const dateB = new Date(b.completionDate || b.stageChangeTimestamp || b.createdDate).getTime();
            return dateB - dateA;
        });

        return filtered;
    }, [projects, archiveTab, searchTerm, filters]);

    const formatCurrency = (amount?: number) => {
        if (!amount) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const formatCompactCurrency = (amount?: number) => {
        const value = amount || 0;
        if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
        if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
        return formatCurrency(value);
    };

    // Use predefined Kerala districts instead of extracting from projects
    const uniqueDistricts = KERALA_DISTRICTS;

    const uniqueCompanies = React.useMemo(() => [...PARENT_COMPANY_OPTIONS], []);
    const isCompletedFilterActive = Boolean(appliedSearchTerm || filters.district || filters.parentCompany);

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />
                
                <div className="px-4 lg:px-12 py-6 lg:py-10 pb-32">
                    <div className="mb-8 animate-premium">
                        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm lg:px-8">
                            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Completed Archive</p>
                                    <h1 className="mt-3 text-3xl lg:text-4xl font-black tracking-tight text-slate-950">
                                        Completed Projects Archive
                                    </h1>
                                    <p className="mt-3 text-sm lg:text-base font-medium leading-7 text-slate-600 hidden sm:block">
                                        {archiveTab === 'completed' && 'View completed deliveries in a clean archive layout with balanced cards and clearer financial presentation.'}
                                        {archiveTab === 'requests' && 'Review project deletion requests in a simpler archive moderation view.'}
                                        {archiveTab === 'dropped' && 'View dropped or deleted project records in the same classic archive layout.'}
                                    </p>
                                </div>

                                {archiveTab === 'completed' && (
                                    <div className="w-full xl:max-w-sm rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Total Archive Value</p>
                                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                                            {completedMetrics ? formatCompactCurrency(completedMetrics.totalValue || 0) : '—'}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {completedMetrics ? formatCurrency(completedMetrics.totalValue || 0) : 'Awaiting metrics'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {isArchiveAdmin && (
                        <Tabs
                            tabs={[
                                { id: 'completed', label: 'Completed Projects', count: tabCounts.completed },
                                { id: 'requests', label: 'Project Deletion Requests', count: tabCounts.requests },
                                { id: 'dropped', label: 'Dropped/Deleted Projects', count: tabCounts.dropped }
                            ]}
                            activeTab={archiveTab}
                            onChange={(tabId) => setArchiveTab(tabId as 'completed' | 'requests' | 'dropped')}
                        />
                    )}

                    {/* Stats Cards */}
                    {archiveTab === 'completed' && (
                        <div className="grid grid-cols-2 2xl:grid-cols-4 gap-2 sm:gap-4 mb-6">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm animate-premium">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Total Projects</p>
                                        <div className="mt-2 sm:mt-3 text-xl sm:text-3xl font-black text-slate-950">{completedMetrics ? completedMetrics.totalProjects : '—'}</div>
                                        <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-600">Archive-wide completed records.</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-emerald-600">
                                        <CheckCircle size={20} />
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm animate-premium">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Total Value</p>
                                        <div className="mt-2 sm:mt-3 text-xl sm:text-3xl font-black tracking-tight text-slate-950">{completedMetrics ? formatCompactCurrency(completedMetrics.totalValue || 0) : '—'}</div>
                                        <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-600">{completedMetrics ? formatCurrency(completedMetrics.totalValue || 0) : 'Awaiting metrics'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sky-600">
                                        <DollarSign size={20} />
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm animate-premium">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Revenue Captured</p>
                                        <div className="mt-2 sm:mt-3 text-xl sm:text-3xl font-black text-slate-950">{completedMetrics ? formatCompactCurrency(completedMetrics.totalInvoiceAmount || 0) : '—'}</div>
                                        <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-600">{completedMetrics ? formatCurrency(completedMetrics.totalInvoiceAmount || 0) : 'Awaiting metrics'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-violet-600">
                                        <TrendingUp size={20} />
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm animate-premium">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Delivery Rhythm</p>
                                        <div className="mt-2 sm:mt-3 text-xl sm:text-3xl font-black text-slate-950">
                                            {completedMetrics ? `${completedMetrics.averageCompletionDays}d` : '—'}
                                        </div>
                                        <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-600">
                                            {completedMetrics ? `${completedMetrics.monthlyCompletedCount} completed this month` : 'Awaiting metrics'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-amber-600">
                                        <Clock size={20} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search and Filters */}
                    <div className="glass-panel rounded-2xl p-4 mb-6 animate-premium shadow-lg">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="relative w-full lg:flex-1">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input
                                    type="text"
                                    placeholder="Search by customer, contact person, or phone..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSearchTerm(value);
                                        if (archiveTab === 'completed' && value.trim() === '' && appliedSearchTerm) {
                                            setAppliedSearchTerm('');
                                            if (filters.district || filters.parentCompany) {
                                                loadCompletedProjectsGlobal('', filters, 1);
                                            } else {
                                                void loadProjects('completed', 1, true);
                                            }
                                        }
                                    }}
                                    className="w-full pl-12 pr-14 py-3 bg-white/50 border-0 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-sm font-medium placeholder:text-gray-400"
                                />
                                {archiveTab === 'completed' && (
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
                            <div className="flex flex-col sm:flex-row lg:flex-wrap lg:justify-end gap-3 lg:flex-none">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                                        showFilters 
                                            ? 'bg-brand-500 text-white' 
                                            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-brand-500'
                                    }`}
                                >
                                    <Filter size={18} />
                                    Filters
                                    <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                </button>
                                {archiveTab === 'completed' && (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <select
                                            value={exportMonths}
                                            onChange={(e) => setExportMonths(Number(e.target.value))}
                                            className="px-4 py-3 bg-white border-2 border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-sm text-slate-800 min-w-[12rem]"
                                            aria-label="Completed export period"
                                        >
                                            {[1, 2, 3, 4, 5, 6].map((month) => (
                                                <option key={month} value={month}>
                                                    Last {month} month{month === 1 ? '' : 's'}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleExportCompletedArchiveCsv}
                                            disabled={archiveExporting}
                                            className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 whitespace-nowrap"
                                        >
                                            <Download size={17} />
                                            {archiveExporting ? 'Preparing CSV...' : 'Export CSV'}
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void handleClearFilters()}
                                    className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-brand-500 hover:bg-slate-50 font-semibold text-sm transition-all whitespace-nowrap"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {showFilters && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">District</label>
                                    <select
                                        value={filters.district}
                                        onChange={(e) => {
                                            const nextFilters = { ...filters, district: e.target.value };
                                            setFilters(nextFilters);
                                            if (archiveTab === 'completed') {
                                                if (appliedSearchTerm || nextFilters.district || nextFilters.parentCompany) {
                                                    loadCompletedProjectsGlobal(appliedSearchTerm, nextFilters, 1);
                                                } else {
                                                    void loadProjects('completed', 1, true);
                                                }
                                            }
                                        }}
                                        className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-sm"
                                    >
                                        <option value="">All Districts</option>
                                        {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Parent Company</label>
                                    <select
                                        value={filters.parentCompany}
                                        onChange={(e) => {
                                            const nextFilters = { ...filters, parentCompany: e.target.value };
                                            setFilters(nextFilters);
                                            if (archiveTab === 'completed') {
                                                if (appliedSearchTerm || nextFilters.district || nextFilters.parentCompany) {
                                                    loadCompletedProjectsGlobal(appliedSearchTerm, nextFilters, 1);
                                                } else {
                                                    void loadProjects('completed', 1, true);
                                                }
                                            }
                                        }}
                                        className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-sm"
                                    >
                                        <option value="">All Companies</option>
                                        {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {archiveTab === 'completed' && !isCompletedFilterActive && (
                        <div className="mb-6 flex items-center justify-between px-4 py-3 border border-gray-200 bg-white/80 rounded-xl">
                            <p className="text-xs text-gray-600">Total completed projects: {completedTotalElements}</p>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={completedPage <= 1 || loading}
                                    onClick={() => {
                                        if (isCompletedFilterActive) {
                                            void loadCompletedProjectsGlobal(appliedSearchTerm, filters, completedPage - 1);
                                            return;
                                        }
                                        void loadProjects('completed', completedPage - 1, true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-gray-600">Page {Math.max(completedPage, 1)} / {Math.max(completedTotalPages, 1)}</span>
                                <button
                                    disabled={completedPage >= completedTotalPages || loading}
                                    onClick={() => {
                                        if (isCompletedFilterActive) {
                                            void loadCompletedProjectsGlobal(appliedSearchTerm, filters, completedPage + 1);
                                            return;
                                        }
                                        void loadProjects('completed', completedPage + 1, true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Projects Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                        </div>
                    ) : filteredAndSortedProjects.length === 0 ? (
                        <div className="glass-panel rounded-2xl p-12 text-center animate-premium">
                            <CheckCircle size={48} className="mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 font-medium">
                                {archiveTab === 'completed' && 'No completed projects found'}
                                {archiveTab === 'requests' && 'No deletion requests found'}
                                {archiveTab === 'dropped' && 'No dropped/deleted projects found'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-5 2xl:grid-cols-2">
                            {filteredAndSortedProjects.map((project) => {
                                const installationItems = parseInstallationItems(project.installationTaskList);
                                const tone = getArchiveCardTone(project);
                                const resolvedProjectValue = project.projectValue ?? project.invoiceAmount ?? 0;
                                const resolvedReceivedAmount = project.totalReceived ?? project.amountReceived ?? project.totalPaidAmount ?? 0;
                                return (
                                <div key={project.id} className={`relative overflow-hidden rounded-3xl border ${tone.shell} p-6 shadow-sm transition-all hover:shadow-md animate-premium`}>
                                    <div className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} />
                                    <div className="flex flex-col justify-between gap-5 h-full">
                                        {/* Left Section - Project Info */}
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${archiveStatusBadgeClass(project)}`}>
                                                            <CheckCircle size={13} />
                                                            {archiveStatusLabel(project)}
                                                        </span>
                                                        {project.projectClassification && (
                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                                                                {project.projectClassification}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950 break-words">{project.school}</h3>
                                                    <p className="mt-1 text-sm font-semibold text-slate-500 break-words">{project.projectName || 'Project name not recorded'}</p>
                                                    <div className="flex flex-wrap gap-2 mt-3 text-sm text-slate-600">
                                                        <div className="flex items-center gap-2 flex-nowrap">
                                                            {project.contactPerson && (
                                                                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 shrink-0">
                                                                    <Building2 size={14} className="shrink-0" />
                                                                    <span className="whitespace-nowrap">{project.contactPerson}</span>
                                                                </span>
                                                            )}
                                                            {project.zone && (
                                                                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 shrink-0">
                                                                    <ShieldCheck size={14} className="shrink-0" />
                                                                    <span className="whitespace-nowrap">{formatZoneLabel(project.zone)}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {project.place && (
                                                            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 shrink-0">
                                                                <MapPin size={14} className="shrink-0" />
                                                                <span className="whitespace-nowrap">{project.place}, {project.district}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                                                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Archive ID</div>
                                                    <div className="mt-1 text-sm font-black text-slate-900">#{project.id}</div>
                                                </div>
                                            </div>

                                            {/* Financial Summary */}
                                            <div className="grid grid-cols-2 2xl:grid-cols-4 gap-2 sm:gap-3">
                                                <div className={`rounded-2xl border p-3 sm:p-4 ${tone.metric}`}>
                                                    <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1 sm:mb-2">Project Value</div>
                                                    <div className="text-sm sm:text-base xl:text-[17px] font-black text-slate-950 leading-snug">
                                                        {formatCurrency(resolvedProjectValue)}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                                                    <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 mb-1 sm:mb-2">Amount Received</div>
                                                    <div className="text-sm sm:text-base xl:text-[17px] font-black text-emerald-950 leading-snug">
                                                        {formatCurrency(resolvedReceivedAmount)}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 sm:p-4 h-full min-h-[80px] sm:min-h-[104px] flex flex-col justify-center text-center">
                                                    <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 mb-1 sm:mb-2">Started</div>
                                                    <div className="text-xs sm:text-sm xl:text-[15px] font-black text-violet-950 leading-snug">
                                                        {formatDateDDMMYYYY(project.createdDate)}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4 h-full min-h-[80px] sm:min-h-[104px] flex flex-col justify-center text-center">
                                                    <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 mb-1 sm:mb-2">Completed</div>
                                                    <div className="text-xs sm:text-sm xl:text-[15px] font-black text-amber-950 leading-snug">
                                                        {formatDateDDMMYYYY(project.completionDate)}
                                                    </div>
                                                </div>
                                            </div>

                                            {project.installationRemarks && (
                                                <div className="text-sm text-gray-600 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                                    <span className="font-semibold text-slate-900">Final Remarks:</span> {project.installationRemarks}
                                                </div>
                                            )}
                                            {archiveTab !== 'completed' && (
                                                <div className="text-sm text-gray-700 bg-amber-50/60 rounded-2xl p-4 border border-amber-100">
                                                    <span className="font-semibold">Deletion Reason:</span> {project.deletionRequestReason || 'N/A'}
                                                </div>
                                            )}
                                            {archiveTab === 'requests' && (
                                                <div className="text-sm text-slate-700 bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-1.5">
                                                    <div>
                                                        <span className="font-semibold">Project Reference:</span>{' '}
                                                        {project.school || 'N/A'} #{project.id}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Current Stage:</span>{' '}
                                                        {project.currentStage || 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Request raised from:</span>{' '}
                                                        {project.deletionRequestedFromStage || project.currentStage || 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Raised by:</span>{' '}
                                                        {project.deletionRequestedBy || 'N/A'} ({formatRoleLabel(project.deletionRequestedByRole)})
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Raised at:</span>{' '}
                                                        {project.deletionRequestedAt
                                                            ? formatDateDDMMYYYY(project.deletionRequestedAt)
                                                            : 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Zone:</span>{' '}
                                                        {project.zone || 'N/A'}
                                                    </div>
                                                </div>
                                            )}
                                            {project.firstMeetingOutcome && (
                                                <div className="text-sm text-amber-700 bg-amber-50 rounded-2xl p-4 border border-amber-100">
                                                    <span className="font-semibold">First Meeting Feedback:</span> {formatFirstMeetingOutcome(project.firstMeetingOutcome)}
                                                </div>
                                            )}
                                            {installationItems.length > 0 && (
                                                <div className="text-sm text-teal-700 bg-teal-50 rounded-2xl p-4 border border-teal-100">
                                                    <span className="font-semibold">Installation Task List:</span>
                                                    <ul className="mt-2 list-disc pl-5 space-y-1 text-teal-700">
                                                        {installationItems.map((item, itemIndex) => (
                                                            <li key={`${project.id}-task-${itemIndex}`}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Section - Actions */}
                                        <div className="grid w-full gap-2 grid-cols-1 sm:grid-cols-2 xl:min-w-[280px] xl:max-w-[320px] self-start">
                                            {project.schoolLocationLink && (
                                                <a
                                                    href={project.schoolLocationLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full min-h-[48px] px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:border-brand-300 hover:bg-brand-50 transition-all font-semibold text-sm inline-flex items-center justify-center gap-2 text-center"
                                                >
                                                    <ExternalLink size={14} />
                                                    Open Map Link
                                                </a>
                                            )}
                                            <button
                                                onClick={() => setSelectedProject(project)}
                                                className="w-full min-h-[48px] px-4 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-semibold text-sm inline-flex items-center justify-center gap-2 text-center"
                                            >
                                                View Journey
                                                <ArrowUpRight size={15} />
                                            </button>
                                            {isArchiveAdmin && archiveTab === 'requests' && project.deletionRequestStatus === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => openReviewDeletionRequest(project.id, true, project.school)}
                                                        className="w-full min-h-[48px] px-4 py-3 bg-green-100 border border-green-300 text-green-700 rounded-2xl hover:bg-green-200 transition-all font-semibold text-sm shadow-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => openReviewDeletionRequest(project.id, false, project.school)}
                                                        className="w-full min-h-[48px] px-4 py-3 bg-red-100 border border-red-300 text-red-700 rounded-2xl hover:bg-red-200 transition-all font-semibold text-sm shadow-sm"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                </div>
            </div>

            {/* Project History Modal */}
            {selectedProject && (
                <PremiumProjectHistoryModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                />
            )}

            {reviewTarget && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[140] p-4" onClick={() => setReviewTarget(null)}>
                    <div className="glass-panel rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            {reviewTarget.approve ? 'Approve Deletion Request' : 'Reject Deletion Request'}
                        </h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Project: {reviewTarget.school}
                        </p>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Remarks (optional)
                        </label>
                        <textarea
                            value={reviewRemarks}
                            onChange={(e) => setReviewRemarks(e.target.value)}
                            placeholder={reviewTarget.approve ? 'Add approval remarks' : 'Add rejection remarks'}
                            className="w-full min-h-[120px] px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm text-gray-800"
                        />
                        <div className="flex justify-end gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setReviewTarget(null)}
                                disabled={reviewSubmitting}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReviewDeletionRequest}
                                disabled={reviewSubmitting}
                                className={`px-4 py-2 rounded-xl text-white font-semibold transition-all disabled:opacity-60 ${
                                    reviewTarget.approve
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                                        : 'bg-gradient-to-r from-red-500 to-rose-600'
                                }`}
                            >
                                {reviewSubmitting ? 'Submitting...' : reviewTarget.approve ? 'Approve Request' : 'Reject Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Project History Modal Component
const ProjectHistoryModal: React.FC<{
    project: Project;
    onClose: () => void;
}> = ({ project, onClose }) => {
    const installationItems = parseInstallationItems(project.installationTaskList);

    const formatCurrency = (amount?: number) => {
        if (!amount) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[140] p-4" onClick={onClose}>
            <div className="glass-panel rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{project.school}</h2>
                            <p className="text-sm text-gray-600 mt-1">Complete Project History</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {project.schoolLocationLink && (
                                <a
                                    href={project.schoolLocationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 bg-brand-50 border border-brand-200 text-brand-700 rounded-lg hover:bg-brand-100 transition-all text-sm font-semibold inline-flex items-center gap-2"
                                >
                                    <ExternalLink size={14} />
                                    Open Customer Location
                                </a>
                            )}
                            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
                        </div>
                </div>

                <div className="space-y-6">
                    {/* Project Details */}
                    <div className="border-b border-gray-200 pb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Project Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="font-semibold">Project Name:</span> {project.projectName || 'N/A'}</div>
                            <div><span className="font-semibold">Contact Person:</span> {project.contactPerson || 'N/A'}</div>
                            <div><span className="font-semibold">Contact Number:</span> {project.contactNumber || 'N/A'}</div>
                            <div><span className="font-semibold">Location:</span> {project.place && project.district ? `${project.place}, ${project.district}` : 'N/A'}</div>
                            <div><span className="font-semibold">Zone:</span> {project.zone || 'N/A'}</div>
                            <div><span className="font-semibold">Parent Company:</span> {project.parentCompany || 'N/A'}</div>
                            <div><span className="font-semibold">Created By:</span> {project.createdBy}</div>
                            <div><span className="font-semibold">Current Stage:</span> {project.currentStage || 'N/A'}</div>
                            <div><span className="font-semibold">Owner Role:</span> {project.currentOwnerRole || 'N/A'}</div>
                            <div><span className="font-semibold">Project Value:</span> {formatCurrency(project.projectValue)}</div>
                            <div><span className="font-semibold">Extra Work Needed:</span> {project.isExtraWorkNeeded ? 'Yes' : 'No'}</div>
                            <div><span className="font-semibold">First Meeting Feedback:</span> {formatFirstMeetingOutcome(project.firstMeetingOutcome)}</div>
                            <div><span className="font-semibold">Payment Status:</span> {project.paymentStatus || 'N/A'}</div>
                            <div><span className="font-semibold">Installation Status:</span> {project.installationStatus || 'N/A'}</div>
                            <div><span className="font-semibold">Expected Delivery:</span> {formatDateDDMMYYYY(project.expectedDeliveryDate)}</div>
                            <div className="col-span-2"><span className="font-semibold">Customer Location Link:</span> {project.schoolLocationLink || 'N/A'}</div>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="border-b border-gray-200 pb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Financial Summary</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="text-sm text-blue-600 mb-1">Invoice Amount</div>
                                <div className="text-xl font-bold text-blue-900">{formatCurrency(project.invoiceAmount)}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="text-sm text-green-600 mb-1">Total Received</div>
                                <div className="text-xl font-bold text-green-900">{formatCurrency(project.totalReceived)}</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="text-sm text-purple-600 mb-1">Completion Date</div>
                                <div className="text-xl font-bold text-purple-900">
                                    {formatDateDDMMYYYY(project.completionDate)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Timeline */}
                    {project.paymentHistory && project.paymentHistory.length > 0 && (
                        <div className="border-b border-gray-200 pb-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Timeline</h3>
                            <div className="space-y-3">
                                {project.paymentHistory
                                    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
                                    .map((payment, index) => (
                                        <div key={payment.id} className="bento-card p-4 hover:shadow-lg transition-all">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-gray-900">
                                                                {formatCurrency(payment.amountPaid)}
                                                            </div>
                                                            <div className="text-sm text-gray-600">
                                                                {new Date(payment.paymentDate).toLocaleDateString('en-GB', {
                                                                    day: '2-digit',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {payment.remarks && (
                                                        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mt-2">
                                                            <span className="font-semibold">Remarks:</span> {payment.remarks}
                                                        </div>
                                                    )}
                                                    {payment.createdBy && (
                                                        <div className="text-xs text-gray-500 mt-2">
                                                            Added by: {payment.createdBy}
                                                        </div>
                                                    )}
                                                </div>
                                                {payment.paymentProofUrl && (
                                                    <a
                                                        href={payment.paymentProofUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-2 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 transition-all text-sm font-semibold flex items-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" />
                                                        </svg>
                                                        View Proof
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="border-b border-gray-200 pb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Project Timeline</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-24 font-semibold text-gray-600">Created:</div>
                                <div className="text-gray-900">{formatDateDDMMYYYY(project.createdDate)}</div>
                            </div>
                            {project.stageChangeTimestamp && (
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-24 font-semibold text-gray-600">Last Stage:</div>
                                    <div className="text-gray-900">{formatDateDDMMYYYY(project.stageChangeTimestamp)}</div>
                                </div>
                            )}
                            {project.completionDate && (
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-24 font-semibold text-gray-600">Completed:</div>
                                    <div className="text-gray-900">{formatDateDDMMYYYY(project.completionDate)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Remarks & Notes */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Remarks & Notes</h3>
                        <div className="space-y-3">
                            {project.executiveRemarks && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-gray-700 mb-1">Executive Remarks:</div>
                                    <div className="text-sm text-gray-600">{project.executiveRemarks}</div>
                                </div>
                            )}
                            {project.firstMeetingOutcome && (
                                <div className="bg-amber-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-amber-700 mb-1">First Meeting Feedback:</div>
                                    <div className="text-sm text-amber-600">{formatFirstMeetingOutcome(project.firstMeetingOutcome)}</div>
                                </div>
                            )}
                            {project.quotationRemarks && (
                                <div className="bg-cyan-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-cyan-700 mb-1">Quotation Remarks:</div>
                                    <div className="text-sm text-cyan-600">{project.quotationRemarks}</div>
                                </div>
                            )}
                            {project.salesRemarks && (
                                <div className="bg-blue-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-blue-700 mb-1">Sales Remarks:</div>
                                    <div className="text-sm text-blue-600">{project.salesRemarks}</div>
                                </div>
                            )}
                            {installationItems.length > 0 && (
                                <div className="bg-teal-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-teal-700 mb-1">Installation Task List:</div>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-teal-600">
                                        {installationItems.map((item, index) => (
                                            <li key={`history-task-${index}`}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {project.paymentRemarks && (
                                <div className="bg-green-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-green-700 mb-1">Payment Remarks:</div>
                                    <div className="text-sm text-green-600">{project.paymentRemarks}</div>
                                </div>
                            )}
                            {project.installationRemarks && (
                                <div className="bg-purple-50 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-purple-700 mb-1">Installation Remarks:</div>
                                    <div className="text-sm text-purple-600">{project.installationRemarks}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const PremiumProjectHistoryModal: React.FC<{
    project: Project;
    onClose: () => void;
}> = ({ project, onClose }) => {
    const installationItems = parseInstallationItems(project.installationTaskList);
    const parentCompanies = splitParentCompanies(project.parentCompany);
    const paymentHistory = [...(project.paymentHistory || [])].sort(
        (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    );
    const rupeeSymbol = '\u20B9';

    const formatCurrency = (amount?: number) => {
        if (!amount) return `${rupeeSymbol}0`;
        return `${rupeeSymbol}${amount.toLocaleString('en-IN')}`;
    };
    const resolvedProjectValue = project.projectValue ?? project.invoiceAmount ?? 0;
    const resolvedReceivedAmount = project.totalReceived ?? project.amountReceived ?? project.totalPaidAmount ?? 0;
    const resolvedPendingAmount = project.pendingAmount ?? Math.max((project.invoiceAmount ?? 0) - resolvedReceivedAmount, 0);
    const isSameDaySalesToAccounts = Boolean(project.salesCompletedAt && project.accountsEntryDate)
        && new Date(project.salesCompletedAt!).toDateString() === new Date(project.accountsEntryDate!).toDateString();
    const completedOwnerRole = project.currentStage === 'COMPLETED' ? 'Completed' : formatRoleLabel(project.currentOwnerRole);
    const durationEndDate = project.stageChangeTimestamp || project.completionDate;
    const feedbackStatusLabel = formatFeedbackLabel(project.feedbackCollected);
    const projectDurationDays = React.useMemo(() => {
        if (!project.createdDate || !durationEndDate) return null;
        const start = new Date(project.createdDate);
        const end = new Date(durationEndDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(diffDays, 0);
    }, [project.createdDate, durationEndDate]);

    const projectSummary = [
        { label: 'Project Name', value: project.projectName || 'Not provided', icon: <Briefcase size={16} className="text-brand-600" /> },
        { label: 'Contact Person', value: project.contactPerson || 'Not provided', icon: <User size={16} className="text-brand-600" /> },
        { label: 'Contact Number', value: project.contactNumber || 'Not provided', icon: <Phone size={16} className="text-brand-600" /> },
        { label: 'Location', value: project.place && project.district ? `${project.place}, ${project.district}` : 'Not provided', icon: <MapPin size={16} className="text-brand-600" /> },
        { label: 'Zone', value: formatZoneLabel(project.zone), icon: <ShieldCheck size={16} className="text-brand-600" /> },
        { label: 'Installation Classification', value: project.projectClassification || 'Not provided', icon: <Layers3 size={16} className="text-brand-600" /> },
        { label: 'Project Ownership', value: completedOwnerRole, icon: <Milestone size={16} className="text-brand-600" /> },
        { label: 'Executive Created By', value: project.createdBy || 'Not provided', icon: <User size={16} className="text-brand-600" /> },
        { label: 'Feedback Status', value: feedbackStatusLabel, icon: <CheckCircle size={16} className="text-brand-600" /> },
        { label: 'Feedback Updated By', value: project.feedbackUpdatedBy || 'Not recorded', icon: <User size={16} className="text-brand-600" /> }
    ];

    let runningRemaining = project.invoiceAmount ?? 0;
    const paymentTimelineEvents = paymentHistory.map((payment, index) => {
        runningRemaining = Math.max(runningRemaining - (payment.amountPaid ?? 0), 0);
        return {
            title: paymentHistory.length === 1 ? 'Payment Recorded' : `Partial Payment ${index + 1}`,
            date: payment.paymentDate,
            tone: 'from-emerald-500 via-teal-500 to-cyan-500',
            detail: `${formatCurrency(payment.amountPaid)} recorded by ${payment.createdBy || 'Accounts user'}.`,
            meta: `${payment.remarks ? `Remarks: ${payment.remarks}. ` : ''}Remaining after this payment: ${formatCurrency(runningRemaining)}`
        };
    });

    const deletionTimelineEvents = [
        project.deletionRequestedAt ? {
            title: 'Deletion Request Raised',
            date: project.deletionRequestedAt,
            tone: 'from-amber-500 via-yellow-500 to-orange-500',
            detail: `Deletion request was raised from ${formatStageLabel(project.deletionRequestedFromStage || project.currentStage)} by ${project.deletionRequestedBy || 'Unknown user'} (${formatRoleLabel(project.deletionRequestedByRole)}).`,
            meta: `Reason: ${project.deletionRequestReason || 'No reason captured.'}`
        } : null,
        project.deletionRequestStatus === 'APPROVED' && project.deletionReviewedAt ? {
            title: 'Deletion Request Approved',
            date: project.deletionReviewedAt,
            tone: 'from-emerald-600 via-green-500 to-lime-500',
            detail: `Deletion request was approved by ${project.deletionReviewedBy || 'Unknown user'} (${formatRoleLabel(project.deletionReviewedByRole)}).`,
            meta: `Approval remarks: ${project.deletionReviewRemarks || 'No approval remarks captured.'}`
        } : null,
        project.deletionRequestStatus === 'REJECTED' && project.deletionReviewedAt ? {
            title: 'Deletion Request Rejected',
            date: project.deletionReviewedAt,
            tone: 'from-rose-600 via-red-500 to-orange-500',
            detail: `Deletion request was rejected by ${project.deletionReviewedBy || 'Unknown user'} (${formatRoleLabel(project.deletionReviewedByRole)}).`,
            meta: `Rejection remarks: ${project.deletionReviewRemarks || 'No rejection remarks captured.'}`
        } : null
    ].filter((item): item is { title: string; date: string; tone: string; detail: string; meta: string } => Boolean(item));

    const stageTimeline = [
        {
            title: 'Executive Lead Created',
            date: project.createdDate,
            tone: 'from-slate-900 via-slate-800 to-slate-700',
            detail: 'Project was first registered in the executive pipeline.',
            meta: `Created by ${project.createdBy || 'executive user'}. Executive remarks: ${project.executiveRemarks || 'No remarks captured.'}`
        },
        {
            title: 'Onboarded',
            date: project.salesEntryDate || project.accountsEntryDate || project.installationEntryDate || project.completionDate,
            tone: 'from-cyan-600 via-sky-600 to-blue-600',
            detail: 'Project moved beyond executive follow-up and entered the internal workflow.',
            meta: project.firstMeetingOutcome ? `Meeting result: ${formatFirstMeetingOutcome(project.firstMeetingOutcome)}` : 'Meeting result was not captured.'
        },
        {
            title: 'Sales Ready for Accounts',
            date: project.salesCompletedAt || project.accountsEntryDate,
            tone: 'from-indigo-600 via-violet-600 to-fuchsia-600',
            detail: 'Sales completed quotation and invoice handoff for accounts.',
            meta: isSameDaySalesToAccounts
                ? `Invoice amount: ${formatCurrency(project.invoiceAmount)}. This handoff and accounts acceptance were recorded on the same day.`
                : `Invoice amount: ${formatCurrency(project.invoiceAmount)}`
        },
        {
            title: 'Accounts Accepted',
            date: project.accountsEntryDate,
            tone: 'from-amber-500 via-orange-500 to-red-500',
            detail: 'Accounts started finance handling for the project.',
            meta: `Payment status: ${formatStageLabel(project.paymentStatus)}`
        },
        ...paymentTimelineEvents,
        {
            title: 'Accounts Cleared for Installation',
            date: project.accountsCompletedAt || project.installationEntryDate,
            tone: 'from-emerald-500 via-green-500 to-teal-500',
            detail: 'Accounts completed its work and handed the project to installation.',
            meta: `Pending amount at handoff: ${formatCurrency(resolvedPendingAmount)}`
        },
        {
            title: 'Installation Started',
            date: project.installationEntryDate,
            tone: 'from-blue-600 via-cyan-600 to-teal-600',
            detail: 'Installation team received the project and began execution planning.',
            meta: installationItems.length > 0 ? `${installationItems.length} installation task(s) recorded.` : 'No installation task list was recorded.'
        },
        {
            title: 'Work Marked Done',
            date: project.installationCompletedAt || project.completionDate,
            tone: 'from-emerald-600 via-lime-500 to-green-500',
            detail: 'Installation team marked the work as done.',
            meta: `Installation status: ${formatStageLabel(project.installationStatus)}. Marked by ${project.installationUserEmail || project.lastUpdatedBy || 'installation user'}.`
        },
        {
            title: 'Project Completed',
            date: project.completionDate,
            tone: 'from-brand-600 via-purple-600 to-indigo-700',
            detail: 'Project was closed and moved into the completed archive.',
            meta: `Final received amount: ${formatCurrency(resolvedReceivedAmount)}`
        },
        project.feedbackUpdatedAt ? {
            title: 'Customer Feedback Updated',
            date: project.feedbackUpdatedAt,
            tone: project.feedbackCollected ? 'from-emerald-600 via-green-500 to-lime-500' : 'from-rose-600 via-red-500 to-orange-500',
            detail: `Feedback was marked ${feedbackStatusLabel.toUpperCase()} by ${project.feedbackUpdatedBy || 'feedback user'}.`,
            meta: 'This completed project has been reviewed by the feedback team.'
        } : null,
        ...deletionTimelineEvents
    ].filter((item): item is { title: string; date: string; tone: string; detail: string; meta: string } => Boolean(item?.date));

    const notes = [
        { title: 'Executive Remarks', value: project.executiveRemarks, tone: 'bg-slate-50 border-slate-200 text-slate-700' },
        { title: 'Quotation Remarks', value: project.quotationRemarks, tone: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
        { title: 'Sales Remarks', value: project.salesRemarks, tone: 'bg-blue-50 border-blue-200 text-blue-700' },
        { title: 'Payment Remarks', value: project.paymentRemarks, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        { title: 'Installation Remarks', value: project.installationRemarks, tone: 'bg-violet-50 border-violet-200 text-violet-700' }
    ].filter((item) => item.value);

    const executiveAdditionalData = [
        { label: 'Cluster', value: project.brc || 'Not recorded' },
        { label: 'Category', value: formatStageLabel(project.projectCategory) },
        { label: 'Project Type', value: formatStageLabel(project.projectType) },
        { label: 'Enquiry', value: formatStageLabel(project.enquiryType) },
        { label: 'Last Visit', value: formatDateLong(project.lastVisitDate) },
        { label: 'Need Help', value: formatStageLabel(project.needHelp) },
        { label: 'Sales Office', value: project.salesOffice ? 'TRUE' : 'FALSE' },
        { label: 'Sales Head', value: project.salesHead ? 'TRUE' : 'FALSE' },
        { label: 'Sales Office Remark', value: formatStageLabel(project.salesOfficeRemark) },
        { label: 'Payment', value: formatStageLabel(project.paymentStatus) }
    ];

    const handleExportProjectJourneyCsv = () => {
        downloadCsvFile(
            `project-journey-${project.id}-${safeFilenamePart(project.school || project.projectName)}.csv`,
            buildProjectJourneyCsvRows(project)
        );
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-stretch justify-center overflow-hidden bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div
                className="glass-panel flex h-[100dvh] min-h-0 w-full max-w-6xl flex-col overflow-y-auto border border-white/60 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:overflow-hidden sm:rounded-[2rem]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 border-b border-white/50 bg-white/90 px-4 py-5 sm:rounded-t-[2rem] sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.18em] ${
                                    archiveStatusBadgeClass(project)
                                }`}>
                                    <CheckCircle size={14} />
                                    {archiveStatusLabel(project)}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.18em] ${getHistoryChipClass(project.paymentStatus)}`}>
                                    {formatStageLabel(project.paymentStatus)}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.18em] ${getHistoryChipClass(project.installationStatus)}`}>
                                    {formatStageLabel(project.installationStatus)}
                                </span>
                                {project.deletionRequestStatus && project.deletionRequestStatus !== 'NONE' && (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.18em] ${getHistoryChipClass(project.deletionRequestStatus)}`}>
                                        Deletion {formatStageLabel(project.deletionRequestStatus)}
                                    </span>
                                )}
                                {project.feedbackCollected !== undefined && project.feedbackCollected !== null && (
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.18em] ${
                                        project.feedbackCollected ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                                    }`}>
                                        Feedback {feedbackStatusLabel}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight break-words">{project.school}</h2>
                            <p className="text-sm sm:text-base text-slate-600 mt-2">
                                Full transition history across executive, sales, accounts, installation, and deletion workflow.
                            </p>
                            <div className="mt-4 grid grid-cols-2 xl:grid-cols-6 gap-2 sm:gap-3">
                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 sm:px-4 py-2 sm:py-3">
                                    <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Project Value</p>
                                    <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1">{formatCurrency(resolvedProjectValue)}</p>
                                </div>
                                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-3 sm:px-4 py-2 sm:py-3">
                                    <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Received</p>
                                    <p className="text-sm sm:text-lg font-bold text-emerald-900 mt-1">{formatCurrency(resolvedReceivedAmount)}</p>
                                </div>
                                <div className="rounded-2xl border border-brand-200/70 bg-brand-50/80 px-3 sm:px-4 py-2 sm:py-3">
                                    <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-brand-600">Completed On</p>
                                    <p className="text-sm sm:text-lg font-bold text-brand-900 mt-1">{formatDateLong(project.completionDate)}</p>
                                </div>
                                <div className="rounded-2xl border border-violet-200/70 bg-violet-50/80 px-3 sm:px-4 py-2 sm:py-3">
                                    <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-violet-600">Project Duration</p>
                                    <p className="text-sm sm:text-lg font-bold text-violet-900 mt-1">
                                        {projectDurationDays != null ? `${projectDurationDays} day${projectDurationDays === 1 ? '' : 's'}` : 'Not recorded'}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3 sm:px-4 py-2 sm:py-3">
                                    <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Installation Class</p>
                                    <p className="text-sm sm:text-lg font-bold text-amber-950 mt-1">{project.projectClassification || 'Not recorded'}</p>
                                </div>
                                <div className={`rounded-2xl border px-4 py-3 ${
                                    project.feedbackCollected === true
                                        ? 'border-emerald-200/70 bg-emerald-50/80'
                                        : project.feedbackCollected === false
                                            ? 'border-rose-200/70 bg-rose-50/80'
                                            : 'border-slate-200/70 bg-slate-50/80'
                                }`}>
                                    <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                                        project.feedbackCollected === true
                                            ? 'text-emerald-700'
                                            : project.feedbackCollected === false
                                                ? 'text-rose-700'
                                                : 'text-slate-500'
                                    }`}>Feedback</p>
                                    <p className={`text-lg font-bold mt-1 ${
                                        project.feedbackCollected === true
                                            ? 'text-emerald-950'
                                            : project.feedbackCollected === false
                                                ? 'text-rose-950'
                                                : 'text-slate-900'
                                    }`}>{feedbackStatusLabel}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
                            <button
                                type="button"
                                onClick={handleExportProjectJourneyCsv}
                                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all text-sm font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <Download size={14} />
                                Export to CSV
                            </button>
                            {project.schoolLocationLink && (
                                <a
                                    href={project.schoolLocationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 bg-brand-50 border border-brand-200 text-brand-700 rounded-xl hover:bg-brand-100 transition-all text-sm font-semibold inline-flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={14} />
                                    Open Customer Location
                                </a>
                            )}
                            <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-all text-sm font-semibold">
                                Close
                            </button>
                        </div>
                    </div>
                </div>

                <div className="premium-history-scroll custom-scrollbar flex-none min-h-0 touch-pan-y space-y-8 overflow-visible p-4 [-webkit-overflow-scrolling:touch] sm:flex-1 sm:overflow-y-auto sm:overscroll-contain sm:p-6 lg:p-8">
                    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                        <div className="rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-xl">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
                                    <Milestone size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">Project Journey</h3>
                                    <p className="text-sm text-slate-200">Every major handoff and completion point in one view.</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {stageTimeline.map((item, index) => (
                                    <div key={`${item.title}-${index}`} className="relative pl-8">
                                        {index !== stageTimeline.length - 1 && (
                                            <div className="absolute left-[13px] top-8 h-[calc(100%+0.5rem)] w-px bg-white/20" />
                                        )}
                                        <div className={`absolute left-0 top-1 h-7 w-7 rounded-full bg-gradient-to-br ${item.tone} shadow-lg border border-white/30`} />
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <h4 className="text-base font-bold">{item.title}</h4>
                                                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-200">{formatDateLong(item.date)}</span>
                                            </div>
                                            <p className="text-sm text-slate-200 mt-2">{item.detail}</p>
                                            <p className="text-xs text-slate-300 mt-2">{item.meta}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 rounded-2xl bg-brand-50 text-brand-600">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Project Snapshot</h3>
                                        <p className="text-sm text-slate-600">Core business and contact details.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {projectSummary.map((item) => (
                                        <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 min-w-0">
                                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                                {item.icon}
                                                {item.label}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-900 mt-2 break-words">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                        <Building2 size={16} className="text-brand-600" />
                                        Parent Companies
                                    </div>
                                    {parentCompanies.length > 0 ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {parentCompanies.map((company) => (
                                                <span
                                                    key={company}
                                                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-sm font-semibold"
                                                >
                                                    {company}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-900 mt-2">Not provided</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                                        <Wallet size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Finance Summary</h3>
                                        <p className="text-sm text-slate-600">Revenue, collections, and remaining balance.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Invoice Amount</p>
                                        <p className="text-lg font-bold text-slate-900 mt-2">{formatCurrency(project.invoiceAmount)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Pending Amount</p>
                                        <p className="text-lg font-bold text-slate-900 mt-2">{formatCurrency(resolvedPendingAmount)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Total Received</p>
                                        <p className="text-lg font-bold text-slate-900 mt-2">{formatCurrency(resolvedReceivedAmount)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Expected Delivery</p>
                                        <p className="text-lg font-bold text-slate-900 mt-2">{formatDateLong(project.expectedDeliveryDate)}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.16em] ${getHistoryChipClass(project.currentStage)}`}>
                                        <Landmark size={13} />
                                        {formatStageLabel(project.currentStage)}
                                    </span>
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.16em] ${getHistoryChipClass(project.paymentStatus)}`}>
                                        <Receipt size={13} />
                                        {formatStageLabel(project.paymentStatus)}
                                    </span>
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-[0.16em] ${getHistoryChipClass(project.installationStatus)}`}>
                                        <Wrench size={13} />
                                        {formatStageLabel(project.installationStatus)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-5 shadow-xl sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 rounded-2xl border border-violet-200 bg-violet-100 p-3 text-violet-700">
                                    <Layers3 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Executive Add Data</h3>
                                    <p className="mt-1 text-sm text-slate-600">Customer details entered by the executive, together with values synchronized from the project workflow.</p>
                                </div>
                            </div>
                            <span className="inline-flex w-fit items-center rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">
                                Project details
                            </span>
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            {executiveAdditionalData.map((item) => (
                                <div key={item.label} className="min-w-0 rounded-2xl border border-violet-100 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600">{item.label}</p>
                                    <p className="mt-2 break-words text-sm font-bold text-slate-900">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Stage Dates</h3>
                                    <p className="text-sm text-slate-600">Recorded checkpoints across the pipeline.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    ['Created', project.createdDate],
                                    ['Sales Entered', project.salesEntryDate],
                                    ['Sales Completed', project.salesCompletedAt],
                                    ['Accounts Entered', project.accountsEntryDate],
                                    ['Accounts Completed', project.accountsCompletedAt],
                                    ['Installation Entered', project.installationEntryDate],
                                    ['Installation Marked Done', project.installationCompletedAt],
                                    ['Completed', project.completionDate],
                                    ['Feedback Updated', project.feedbackUpdatedAt]
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
                                        <p className="text-sm font-semibold text-slate-900 mt-2">{formatDateLong(value)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                                    <Receipt size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Payment Timeline</h3>
                                    <p className="text-sm text-slate-600">Installments and proofs recorded by accounts.</p>
                                </div>
                            </div>
                            {paymentHistory.length > 0 ? (
                                <div className="space-y-3">
                                    {paymentHistory.map((payment, index) => (
                                        <div key={payment.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-slate-900">{formatCurrency(payment.amountPaid)}</div>
                                                            <div className="text-sm text-slate-600">{formatDateLong(payment.paymentDate)}</div>
                                                        </div>
                                                    </div>
                                                    {payment.remarks && (
                                                        <div className="text-sm text-slate-600 bg-white rounded-xl p-3 mt-3 border border-slate-200">
                                                            <span className="font-semibold text-slate-800">Remarks:</span> {payment.remarks}
                                                        </div>
                                                    )}
                                                    {payment.createdBy && (
                                                        <div className="text-xs text-slate-500 mt-3">Added by {payment.createdBy}</div>
                                                    )}
                                                </div>
                                                {payment.paymentProofUrl && (
                                                    <a
                                                        href={payment.paymentProofUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-2 bg-brand-100 text-brand-700 rounded-xl hover:bg-brand-200 transition-all text-sm font-semibold inline-flex items-center justify-center gap-2 self-start"
                                                    >
                                                        <ExternalLink size={14} />
                                                        View Proof
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm text-slate-600">
                                    No payment installments were recorded for this project.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
                        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-violet-50 text-violet-600">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Remarks & Decisions</h3>
                                    <p className="text-sm text-slate-600">Everything captured by each team along the way.</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {project.firstMeetingOutcome && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                        <div className="text-sm font-semibold text-amber-700 mb-1">First Meeting Feedback</div>
                                        <div className="text-sm text-amber-700">{formatFirstMeetingOutcome(project.firstMeetingOutcome)}</div>
                                    </div>
                                )}
                                {notes.length > 0 ? notes.map((item) => (
                                    <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                                        <div className="text-sm font-semibold mb-1">{item.title}</div>
                                        <div className="text-sm leading-relaxed">{item.value}</div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm text-slate-600">
                                        No remarks were recorded for this project.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-teal-50 text-teal-600">
                                    <Wrench size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Delivery Notes</h3>
                                    <p className="text-sm text-slate-600">Operational details for execution and closure.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Extra Work Needed</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-2">{project.isExtraWorkNeeded ? 'Yes' : 'No'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Last Stage Update</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-2">{formatDateLong(project.stageChangeTimestamp)}</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                                <div className="text-sm font-semibold text-slate-900 mb-3">Installation Task List</div>
                                {installationItems.length > 0 ? (
                                    <ul className="space-y-2">
                                        {installationItems.map((item, index) => (
                                            <li key={`history-task-${index}`} className="flex items-start gap-3 text-sm text-slate-700">
                                                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-black">
                                                    {index + 1}
                                                </span>
                                                <span className="leading-relaxed">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-slate-600">No installation task list was added for this project.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
