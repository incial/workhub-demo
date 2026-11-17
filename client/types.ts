
export type CRMStatus = 'onboarded' | 'drop' | 'on progress' | 'Quote Sent' | 'lead' | 'completed';

// Work Hub CRM Project Stages
export type ProjectStage = 
  | 'LEAD' 
  | 'ON_PROGRESS' 
  | 'QUOTATION_SENT' 
  | 'IN_REVIEW' 
  | 'ONBOARDED' 
  | 'SALES' 
  | 'ACCOUNTS' 
  | 'INSTALLATION' 
  | 'COMPLETED'
  | 'DROPPED';

export type FirstMeetingOutcome = 'POSITIVE' | 'NEGATIVE' | 'FIFTY_FIFTY';

// Executive view classification (computed server-side from workflow stage)
export type ExecutiveProjectStatus = 
  | 'NON_ONBOARDED'      // LEAD, ON_PROGRESS, QUOTATION_SENT, IN_REVIEW
  | 'ONBOARDED_ACTIVE'   // ONBOARDED, SALES, ACCOUNTS, INSTALLATION
  | 'COMPLETED';         // COMPLETED

// Universal dashboard role types
export type DashboardRole = 'EXECUTIVE' | 'SALES' | 'ACCOUNTS' | 'INSTALLATION';

// Universal project view bucket (role-based categorization)
export type ProjectViewBucket = 
  | 'UPCOMING'       // Projects pending this role's attention
  | 'ACTIVE'         // Projects actively being worked on
  | 'DONE'           // Projects completed from this role's perspective
  | 'NOT_RELEVANT';  // Projects outside this role's domain

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'PENDING_INPUT';
export type InstallationStatus = 'PENDING' | 'WORK_DONE' | 'NOT_DONE';
export type Region = 'North' | 'South';
export type Zone = 'ZONE_1' | 'ZONE_2' | 'ZONE_3';
export type ProjectClassification = 'I1' | 'I2' | 'I3';
export type ExecutiveProjectCategory = 'STAR' | 'COMMON' | 'ART_AND_CRAFTS' | 'SYSTEMATICS';
export type EnquiryType = 'OUTDOOR' | 'INDOOR' | 'FURNITURE' | 'LAB_ART_WORK' | 'NO_ENQUIRIES';
export type NeedHelp = 'NO_NEED' | 'SALES_OFFICE' | 'SALES_HEAD' | 'MANAGEMENT' | 'OTHER_DEPARTMENTS';
export type SalesOfficeRemark =
  | 'INFORMED_TO_SM'
  | 'INFORMED_TO_OPRN_DEP'
  | 'INFORMED_TO_COO'
  | 'INFORMED_TO_MD'
  | 'GIVEN_ESTIMATION'
  | 'WORK_ORDER_RECEIVED'
  | 'DELIVERY_COMPLETED'
  | 'INSTALLATION_COMPLETED';

export type UserRole = 'ROLE_SUPER_ADMIN' | 'ROLE_ADMIN' | 'ROLE_EMPLOYEE' | 'ROLE_CLIENT' 
  | 'ROLE_EXECUTIVE' | 'ROLE_SALES_COORDINATOR' | 'ROLE_ACCOUNTS' | 'ROLE_INSTALLATION' | 'ROLE_PRODUCTION' | 'ROLE_ZONAL_MANAGER' | 'ROLE_OPERATOR' | 'ROLE_FEEDBACK' | 'ROLE_DEMO';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  zone?: Zone | null;
  termsAccepted?: boolean;
  policyVersion?: string;
  policyAcceptedAt?: string;
  clientCrmId?: number; // Linked CRM ID for Client Role
  googleId?: string; 
  avatarUrl?: string; 
  createdAt?: string; 
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  executiveOnboardedCount?: number;
  salesToAccountsCount?: number;
  accountsToInstallationCount?: number;
  installationDoneCount?: number;
}

export interface AuthResponse {
  statusCode: number;
  token: string;
  role: string;
  user: User;
  message: string;
}

export interface RegisterRequest {
  name?: string;
  email: string;
  password: string;
  role: string;
  zone: Zone;
  clientCrmId?: number;
}

export interface OperatorCreateUserRequest {
  name: string;
  email: string;
  password?: string;
  role: string;
  zone?: Zone;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ChangePasswordRequest {
  email: string;
  newPassword: string; 
  otp: string; 
}

export interface SocialLinks {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  twitter?: string;
  other?: string;
}

export interface CRMEntry {
  id: number;
  company: string;
  phone: string;
  email: string;
  contactName: string;
  assignedTo: string;
  assigneeId?: number; // Linked User ID
  address?: string; 
  companyImageUrl?: string; 
  lastContact: string; 
  nextFollowUp: string; 
  dealValue: number;
  notes: string;
  status: CRMStatus;
  tags: string[];
  work: string[];
  leadSources: string[];
  driveLink?: string; 
  socials?: SocialLinks;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  referenceId?: string; 
}

export interface FilterState {
  status: string;
  assignedTo: string;
  search: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface CompanyFilterState {
  search: string;
  status: string;
  workType: string;
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'In Review' | 'Posted' | 'Completed' | 'Dropped' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskType = 'General' | 'Reel' | 'Post' | 'Story' | 'Carousel' | 'Video';

export interface Task {
  id: number;
  companyId?: number; 
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskType?: TaskType; 
  assignedTo?: string; // Deprecated: for backward compatibility
  assignedToList?: string[]; // New: list of assignee emails
  assigneeId?: number; // Deprecated: for backward compatibility
  dueDate: string; 
  attachments?: string[]; 
  taskLink?: string; 
  createdAt: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  isVisibleOnMainBoard?: boolean; 
}

export interface TaskFilterState {
  search: string;
  status: string;
  priority: string;
  assignedTo: string;
}

export type MeetingStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';

export interface Meeting {
  id: number;
  title: string;
  dateTime: string; 
  status: MeetingStatus;
  meetingLink?: string;
  notes?: string;
  companyId?: number; 
  assignedTo?: string;
  assigneeId?: number; // Linked User ID
  createdAt: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export interface MeetingFilterState {
  search: string;
  status: string;
  dateRangeStart: string;
}

export type InvoiceStatus = 'Draft' | 'Pending' | 'Paid' | 'Overdue';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  clientEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export type CalendarItem = {
    id: string; 
    dateStr: string; 
    sortTime: number; 
    title: string;
    type: 'task' | 'meeting';
    data: Task | Meeting;
    status: string;
    priority?: string; 
};

// Payment Transaction for Installment Tracking
export interface PaymentTransaction {
  id: number;
  projectId: number;
  amountPaid: number;
  paymentDate: string;
  paymentProofUrl?: string;
  remarks?: string;
  createdAt: string;
  createdBy: string;
}

// Work Hub CRM Project Entity
export interface Project {
  id: number;
  
  // Base Information
  school: string;
  contactPerson?: string;
  contactNumber?: string;
  place?: string;
  district?: string;
  region?: Region;
  zone?: Zone;
  projectName?: string;
  parentCompany?: string;
  executiveRemarks?: string;
  schoolLocationLink?: string;
  lastContact?: string;
  nextContact?: string;
  createdDate: string;
  createdBy: string;
  
  // Stage Tracking
  currentStage: ProjectStage;
  onboarded?: boolean;
  previousStage?: ProjectStage;
  stageChangeTimestamp?: string;
  stageChangedBy?: string;
  currentOwnerRole?: string;
  firstMeetingOutcome?: FirstMeetingOutcome;
  brc?: string;
  projectCategory?: string;
  projectType?: ExecutiveProjectCategory;
  enquiryType?: EnquiryType;
  lastVisitDate?: string;
  needHelp?: NeedHelp;
  salesOffice?: boolean;
  salesHead?: boolean;
  salesOfficeRemark?: SalesOfficeRemark;
  
  // Executive View Status (computed server-side from currentStage)
  // Used for executive dashboard tab categorization
  executiveViewStatus?: ExecutiveProjectStatus;
  
  // Universal View Bucket (computed server-side based on role and stage)
  // Used for all role-based dashboards (Executive, Sales, Accounts, Installation)
  viewBucket?: ProjectViewBucket;
  
  // Sales Data
  projectValue?: number;
  isExtraWorkNeeded?: boolean;
  invoiceAmount?: number;
  quotationRemarks?: string;
  expectedDeliveryDate?: string;
  salesRemarks?: string;
  installationTaskList?: string;
  projectClassification?: ProjectClassification;
  salesUpdatedTimestamp?: string;
  salesUserEmail?: string;
  salesEntryDate?: string;
  salesCompletedAt?: string;
  
  // Accounts Data
  paymentStatus?: PaymentStatus;
  amountReceived?: number;
  pendingAmount?: number;
  totalPaidAmount?: number;
  totalReceived?: number;  // Calculated sum from payment transactions
  paymentHistory?: PaymentTransaction[];  // List of all payment transactions
  paymentDate?: string;
  paymentRemarks?: string;
  paymentProofUrl?: string;
  accountsUpdatedTimestamp?: string;
  accountsUserEmail?: string;
  accountsEntryDate?: string;
  accountsCompletedAt?: string;
  salesStatusLastNotified?: 'GREEN' | 'YELLOW' | 'RED';
  accountsStatusLastNotified?: 'GREEN' | 'YELLOW' | 'RED';
  
  // Installation Data
  installationStatus?: InstallationStatus;
  installationRemarks?: string;
  completionDate?: string;
  installationUpdatedTimestamp?: string;
  installationUserEmail?: string;
  installationEntryDate?: string;
  installationCompletedAt?: string;
  feedbackCollected?: boolean;
  feedbackUpdatedAt?: string;
  feedbackUpdatedBy?: string;
  
  // Audit
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  isLocked?: boolean;

  // Deletion Workflow
  deletionRequestStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  deletionRequestReason?: string;
  deletionRequestedBy?: string;
  deletionRequestedByRole?: string;
  deletionRequestedAt?: string;
  deletionRequestedFromStage?: string;
  deletionReviewedBy?: string;
  deletionReviewedByRole?: string;
  deletionReviewRemarks?: string;
  deletionReviewedAt?: string;
}

export interface CreateProjectRequest {
  school: string;
  contactPerson?: string;
  contactNumber?: string;
  place?: string;
  district?: string;
  region?: Region;
  zone?: Zone;
  projectName?: string;
  parentCompany?: string;
  executiveRemarks?: string;
  schoolLocationLink?: string;
  lastContact?: string;
  nextContact?: string;
  firstMeetingOutcome?: FirstMeetingOutcome;
  projectValue?: number;
  invoiceAmount?: number;
  isExtraWorkNeeded?: boolean;
}

export interface UpdateExecutiveAdditionalDataRequest {
  brc?: string;
  projectCategory?: string;
  projectType?: ExecutiveProjectCategory;
  enquiryType?: EnquiryType;
  needHelp?: NeedHelp;
  salesOfficeRemark?: SalesOfficeRemark;
}

export interface UpdateSalesDataRequest {
  invoiceAmount?: number;
  quotationRemarks?: string;
  expectedDeliveryDate?: string;
  salesRemarks?: string;
  installationTaskList?: string;
  projectClassification?: ProjectClassification;
}

export interface UpdateAccountsDataRequest {
  paymentRequestId?: string;
  paymentStatus?: PaymentStatus;
  invoiceAmount?: number;
  amountReceived?: number;
  pendingAmount?: number;
  paymentDate?: string;
  paymentRemarks?: string;
  paymentProofUrl?: string;
}

export interface UpdateInstallationDataRequest {
  installationStatus?: InstallationStatus;
  installationRemarks?: string;
  completionDate?: string;
}

export interface ProjectDeletionRequestCreateRequest {
  reason?: string;
}

export interface ProjectDeletionReviewRequest {
  approve: boolean;
  remarks?: string;
}

export interface FeedbackProject {
  id: number;
  school: string;
  projectName?: string;
  createdBy?: string;
  zone?: Zone;
  contactPerson?: string;
  contactNumber?: string;
  feedbackCollected?: boolean;
  completionDate?: string;
  createdDate?: string;
  lastUpdatedAt?: string;
}

export interface ProductionProduct {
  id: number;
  name: string;
  category: string;
  status: string;
}

export interface ProductionEntry {
  entryId?: number;
  month: number;
  year: number;
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  timestamp?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedByRole?: string;
  updatedByZone?: string;
  updatedByAvatarUrl?: string;
}

export interface ProductionMonthSummary {
  month: number;
  year: number;
  totalQuantity: number;
  entries: ProductionEntry[];
}

export interface ProductionQuantityUpdate {
  productId: number;
  quantity: number;
}

export interface SaveMonthlyProductionRequest {
  month: number;
  year: number;
  quantities: ProductionQuantityUpdate[];
}

export interface CreateProductionProductRequest {
  name: string;
  category: string;
}

export interface ProductionTrend {
  month: number;
  totalQuantity: number;
}

export interface StageTransitionRequest {
  toStage: ProjectStage;
  remarks?: string;
}

export interface ProjectFilterState {
  stage?: ProjectStage;
  district?: string;
  region?: Region;
  parentCompany?: string;
  search?: string;
}

// Analytics Types
export interface StageDistribution {
  stage: string;
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  projectCount: number;
  revenue: number;
  completedCount: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  completedRevenue: number;
  pendingRevenue: number;
  totalReceived: number;
  totalPending: number;
}

export interface Analytics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  successRate: number;
  financialSummary: FinancialSummary;
  stageDistribution: StageDistribution[];
  monthlyTrends: MonthlyTrend[];
  projectsThisMonth: number;
  completedThisMonth: number;
  pendingFeedbackProjects?: number;
  revenueThisMonth: number;
  averageCompletionDays?: number;
  productionSummary?: ProductionSummary;
  statusInsights?: DashboardStatusInsights;
  projectCreationLimitStatus?: ProjectCreationLimitStatus;
}

export type SchoolVisitStatus = 'SCHEDULED' | 'VISITED' | 'NOT_VISITED' | 'CANCELLED';

export interface SchoolVisit {
  id: number;
  projectId: number;
  school: string;
  projectName?: string;
  scheduledFor: string;
  assignedTo: string;
  scheduledBy: string;
  executiveRemark?: string;
  status: SchoolVisitStatus;
  visitNote?: string;
  notVisitedReason?: string;
  outcomeRecordedAt?: string;
  outcomeRecordedBy?: string;
  createdAt: string;
}

export interface CreateSchoolVisitRequest {
  scheduledFor: string;
  executiveRemark: string;
  nextContact?: string;
  assignedTo?: string;
}

export interface RecordSchoolVisitOutcomeRequest {
  visited: boolean;
  visitNote?: string;
  notVisitedReason?: string;
}

export interface StatusBreakdown {
  red: number;
  yellow: number;
  green: number;
}

export interface DashboardStatusInsights {
  paymentActivity: StatusBreakdown;
  salesUpdation: StatusBreakdown;
  accounts: StatusBreakdown;
  executive: StatusBreakdown;
}

export interface ProjectCreationLimitStatus {
  creationBlocked: boolean;
  projectLimitReached: boolean;
  pipelineLimitReached: boolean;
  title?: string;
  message?: string;
}

export interface ProductionSummary {
  currentMonthQuantity: number;
  yearToDateQuantity: number;
  monthlyProductionTrend: number;
  recentEntries: ProductionEntry[];
  topProductsThisMonth: Record<string, number>;
}

// Activity Tracking Types
export type ActivityEntityType =
  | 'PROJECT'
  | 'PAYMENT'
  | 'PRODUCTION_ENTRY'
  | 'PRODUCTION_PRODUCT'
  | 'INSTALLATION'
  | 'USER';

export type ActivityActionType =
  | 'EXECUTIVE_LEAD_CREATED'
  | 'EXECUTIVE_STAGE_ADVANCED'
  | 'EXECUTIVE_STAGE_REJECTED'
  | 'EXECUTIVE_PROJECT_UPDATED'
  | 'EXECUTIVE_PROJECT_DELETED'
  | 'EXECUTIVE_APPROVAL_INITIATED'
  | 'SALES_VALUE_ENTERED'
  | 'SALES_DETAILS_UPDATED'
  | 'SALES_TASK_LIST_SET'
  | 'ACCOUNTS_PAYMENT_RECORDED'
  | 'ACCOUNTS_PAYMENT_APPROVED'
  | 'ACCOUNTS_PAYMENT_REJECTED'
  | 'ACCOUNTS_AMOUNT_UPDATED'
  | 'PRODUCTION_ENTRY_SAVED'
  | 'PRODUCTION_STATUS_UPDATED'
  | 'PRODUCTION_PRODUCT_ADDED'
  | 'INSTALLATION_STATUS_UPDATED'
  | 'INSTALLATION_COMPLETED'
  | 'INSTALLATION_REMARKS_UPDATED'
  | 'ADMIN_USER_ROLE_UPDATED';

export interface UserActivityLog {
  id: number;
  userId: number;
  userRole: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: number;
  timestamp: string;
  metadata: Record<string, any>;
  ipAddress?: string;
}

export interface UserActivityStatement {
  userId: number;
  userName: string;
  role: string;
  from: string;
  to: string;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  roleContributions: Record<string, any>;
  activityTimeline: UserActivityLog[];
}

export interface TrackingMetric {
  label: string;
  value: number;
}

export interface TrackingProjectRow {
  id: number;
  school?: string;
  place?: string;
  district?: string;
  region?: string;
  contactPerson?: string;
  contactNumber?: string;
  projectName?: string;
  currentStage?: string;
  onboarded?: boolean;
  installationStatus?: string;
  zone?: string;
  dueDate?: string;
  daysOverdue?: number;
  createdDate?: string;
  stageEntryDate?: string;
  statusColor?: 'RED' | 'YELLOW' | 'GREEN' | string;
  completedAt?: string;
  executiveRemarks?: string;
  firstMeetingOutcome?: string;
}

export interface TrackingCard {
  key: string;
  label: string;
  count: number;
  rows: TrackingProjectRow[];
}

export interface UserTrackingData {
  box1Metrics: TrackingMetric[];
  box2Cards: TrackingCard[];
  statusSummaryCards: TrackingCard[];
  projectTableRows: TrackingProjectRow[];
}

export interface TrackingProjectLite {
  id: number;
  name: string;
  school?: string;
  place?: string;
  district?: string;
  region?: string;
  contactPerson?: string;
  contactNumber?: string;
  currentStage?: string;
  onboarded?: boolean;
  installationStatus?: string;
  pendingAmount?: number;
  nextFollowupDate?: string;
  createdDate?: string;
  stageEntryDate?: string;
  onboardedDate?: string;
  completedAt?: string;
  completedBy?: string;
  color?: 'RED' | 'YELLOW' | 'GREEN' | string;
  executiveRemarks?: string;
  firstMeetingOutcome?: string;
}

export interface ExecutiveTrackingResponse {
  leads: number;
  onboarded: number;
  completed: number;
  dropped: number;
  dueProjects: TrackingProjectLite[];
  nonOnboardedProjects: TrackingProjectLite[];
  onboardedProjects: TrackingProjectLite[];
}

export interface RoleBasedTrackingResponse {
  role: string;
  completed: number;
  completedProjects: TrackingProjectLite[];
  pipelineProjects: TrackingProjectLite[];
  upcomingProjects: TrackingProjectLite[];
  activeProjects: TrackingProjectLite[];
}

export type AuditCategory = 'LOGIN' | 'PROJECT' | 'PASSWORD';

export interface AuditLogRow {
  id: number;
  event: string;
  description?: string;
  projectName?: string;
  amountReceived?: number;
  pendingAmount?: number;
  actor: {
    name: string;
    email: string;
    role?: string;
    zone?: string;
    avatarUrl?: string;
    createdAt?: string;
  };
  category: AuditCategory;
  timestamp: string;
}

export interface AuditActivityCounts {
  LOGIN_ACTIVITY: number;
  PROJECT_VISITING_ACTIVITY: number;
  PROJECT_ACTIVITY: number;
  PROJECT_COMPLETION: number;
  PAYMENT_ACTIVITY: number;
  DELETION_ACTIVITY: number;
  PASSWORD_RESET_ACTIVITY: number;
}

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CompletedProjectMetrics {
    totalProjects: number;
    totalValue: number;
    totalInvoiceAmount?: number;
    monthlyCompletedCount: number;
    averageCompletionDays: number;
    currentMonthProjects?: number;
  averageDuration?: number;
}

// Reporting Types
export interface ProjectTrackingReportRow {
  projectId: number;
  customerName?: string;
  projectName?: string;
  stage?: string;
  zone?: string;
  projectValue?: number;
  invoiceAmount?: number;
  pendingAmount?: number;
  paymentStatus?: 'GREEN' | 'YELLOW' | 'RED' | string;
  createdDate?: string;
  executiveName?: string;
  executiveEmail?: string;
  executiveAvatarUrl?: string;
  stageChangedAt?: string;
  nextDayFollowUp?: string;
  lastContactDate?: string;
  lastVisitDate?: string;
  brc?: string;
  projectCategory?: string;
  projectType?: ExecutiveProjectCategory;
  enquiryType?: EnquiryType;
  needHelp?: NeedHelp;
  salesOffice?: boolean;
  salesHead?: boolean;
  salesOfficeRemark?: SalesOfficeRemark;
  completedDate?: string;
  amountReceived?: number;
  stageChangedBy?: string;
  lastUpdatedBy?: string;
}

export interface ExecutiveActivityRow {
  activityDate: string;
  projectId: number;
  executiveName: string;
  school: string;
  projectWork?: string;
}

export interface ExecutiveActivityReport {
  from: string;
  to: string;
  schoolVisits: ExecutiveActivityRow[];
  projectsCreated: ExecutiveActivityRow[];
}

export interface PaymentAgingReportRow {
  projectId: number;
  customerName?: string;
  projectName?: string;
  pendingAmount?: number;
  agingDays?: number;
  agingBucket?: string;
  statusColor?: string;
}

export interface SalesPendingCount {
  totalSalesProjects: number;
  pendingDeliveryCount: number;
}

export interface DashboardBadgeCounts {
  onboardedCount: number;
  activeCount: number;
  completedCount: number;
}

export interface CompletedArchiveBadgeCounts {
  completed: number;
  requests: number;
  dropped: number;
}

export interface EmployeeStatusReportRow {
  employeeId?: number;
  employeeName: string;
  employeeEmail: string;
  role?: string;
  zone?: string;
  executiveProjects: number;
  salesProjects: number;
  accountsProjects: number;
  redProjects: number;
  yellowProjects: number;
  greenProjects: number;
  executiveFollowUpDueCount: number;
  executiveFollowUpOverdueCount: number;
}
