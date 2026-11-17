import { paymentRequestId, completePaymentRequest } from './paymentRetry';
import axios from 'axios';
import { DEMO_SESSION_KEY, demoLogin } from '../demo/session';
import { AuthResponse, User, ForgotPasswordRequest, VerifyOtpRequest, ChangePasswordRequest, ApiResponse, RegisterRequest, OperatorCreateUserRequest, Project, CreateProjectRequest, UpdateExecutiveAdditionalDataRequest, UpdateSalesDataRequest, UpdateAccountsDataRequest, UpdateInstallationDataRequest, StageTransitionRequest, ProjectStage, Analytics, StageDistribution, MonthlyTrend, FinancialSummary, ProductionProduct, ProductionEntry, ProductionMonthSummary, SaveMonthlyProductionRequest, CreateProductionProductRequest, ProductionTrend, UserActivityLog, UserActivityStatement, ActivityEntityType, PageResult, ProjectTrackingReportRow, PaymentAgingReportRow, SalesPendingCount, AuditLogRow, AuditCategory, ProjectDeletionRequestCreateRequest, ProjectDeletionReviewRequest, CompletedProjectMetrics, ExecutiveProjectStatus, ProjectViewBucket, DashboardRole, AuditActivityCounts, EmployeeStatusReportRow, UserTrackingData, ExecutiveTrackingResponse, RoleBasedTrackingResponse, DashboardBadgeCounts, CompletedArchiveBadgeCounts, FeedbackProject, ProjectCreationLimitStatus, SchoolVisit, CreateSchoolVisitRequest, RecordSchoolVisitOutcomeRequest, ExecutiveActivityReport } from '../types';

// ============================================================================
// ⚙️ API CONFIGURATION — frontend-only showcase
// ============================================================================
// There is no backend. Every request below is answered by the in-browser
// simulator in `demo/adapter.ts`, which keeps its data in localStorage.
// No HTTP request ever leaves the browser.

const api = axios.create({
  baseURL: '/api/v1',
  adapter: async config => (await import('../demo/adapter')).demoAdapter(config),
});

const requestSessions = new WeakMap<object, string>();
const sessionFingerprint = () => localStorage.getItem(DEMO_SESSION_KEY) || '';

api.interceptors.request.use((config) => {
  requestSessions.set(config, sessionFingerprint());
  config.headers.delete('Authorization');
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (requestSessions.get(response.config) !== sessionFingerprint()) throw new axios.CanceledError('Login session changed.');
    return response;
  },
  (error) => {
    if (error.config && requestSessions.get(error.config) !== sessionFingerprint()) {
      return Promise.reject(new axios.CanceledError('Login session changed.'));
    }
    const requestUrl = String(error?.config?.url || '');
    const isPublicAuthRequest = requestUrl.startsWith('/auth/');
    // A 401 means the local demo session is missing or damaged.
    if (!isPublicAuthRequest && error.response && error.response.status === 401) {
        window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Helper to extract error message from backend response
const extractApiErrorMessage = (responseData: any): string | null => {
    if (!responseData) return null;

    if (typeof responseData === 'string') {
        const trimmed = responseData.trim();
        return trimmed ? trimmed : null;
    }

    if (Array.isArray(responseData)) {
        for (const item of responseData) {
            const nested = extractApiErrorMessage(item);
            if (nested) return nested;
        }
        return null;
    }

    if (typeof responseData === 'object') {
        const prioritizedFields = ['message', 'error', 'errorCode', 'details'];
        for (const field of prioritizedFields) {
            const value = responseData[field];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }

        if (responseData.data) {
            const nested = extractApiErrorMessage(responseData.data);
            if (nested) return nested;
        }

        for (const value of Object.values(responseData)) {
            const nested = extractApiErrorMessage(value);
            if (nested) return nested;
        }
    }

    return null;
};

const handleApiError = (error: any) => {
    if (axios.isCancel(error)) throw error;
    if (error.response) {
        // The local simulator rejected the request (validation or workflow rule).
        const message =
            extractApiErrorMessage(error.response.data)
            || error.response.statusText
            || `Request failed (${error.response.status})`;
        throw new Error(message);
    } else if (error.request) {
        throw new Error("The local demo could not process this request. Reset demo data and try again.");
    } else {
        throw new Error(error.message);
    }
};

// Helper to clean payload
const cleanPayload = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(cleanPayload);
    }
    
    if (data !== null && typeof data === 'object') {
        const cleaned: any = {};
        const excludeFields = ['id', 'createdAt', 'lastUpdatedAt'];

        Object.keys(data).forEach(key => {
            if (excludeFields.includes(key)) return;
            const value = data[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                cleaned[key] = cleanPayload(value);
            } 
            else if (value !== "" && value !== null && value !== undefined) {
                cleaned[key] = value;
            }
        });
        return cleaned;
    }
    return data;
};

// ============================================================================
// 🔌 API ENDPOINTS
// ============================================================================

// --- USERS API ---
export const usersApi = {
  getAll: async (zone?: string): Promise<User[]> => {
    try {
        const res = await api.get(`/users/all${toQueryString({ zone })}`);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  getDirectory: async (zone?: string, roles?: string[]): Promise<User[]> => {
    try {
        const res = await api.get(`/users/directory${toQueryString({
          zone,
          roles: roles && roles.length > 0 ? roles.join(',') : undefined
        })}`);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },
  
  update: async (id: number, data: Partial<User>): Promise<User> => {
    try {
        const res = await api.put(`/users/update/${id}`, data);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  create: async (data: OperatorCreateUserRequest): Promise<User> => {
    try {
      const res = await api.post('/users/create', data);
      return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  updateMyName: async (name: string): Promise<User> => {
    try {
      const res = await api.patch('/users/update-name', { name });
      return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  delete: async (id: number): Promise<void> => {
    try {
        await api.delete(`/users/delete/${id}`);
    } catch (error) { throw handleApiError(error); }
  }
};

// --- AUTH API ---
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const demo = demoLogin(email, password);
    if (demo) return demo;
    throw new Error('Invalid email or password. Use the demo credentials shown on the sign-in page.');
  },

  googleLogin: async (_credential: string): Promise<AuthResponse> => {
    throw new Error('Google sign-in is not available in the frontend-only demo.');
  },

  registerUser: async (_data: RegisterRequest): Promise<AuthResponse> => {
    throw new Error('Public registration is disabled. Add staff from the Operator workspace instead.');
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<ApiResponse> => {
    try {
        const res = await api.post("/auth/forgot-password", data);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  verifyOtp: async (data: VerifyOtpRequest): Promise<ApiResponse> => {
    try {
        const res = await api.post("/auth/verify-otp", data);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  changePassword: async (data: ChangePasswordRequest): Promise<ApiResponse> => {
    try {
        const res = await api.post("/auth/change-password", data);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  requestPasswordUpdateOtp: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<ApiResponse> => {
    try {
        const res = await api.post("/auth/password/change/request", data);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  confirmPasswordUpdate: async (data: { otp: string; newPassword: string }): Promise<ApiResponse> => {
    try {
        const res = await api.post("/auth/password/change/confirm", data);
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  getCurrentUser: async (): Promise<User> => {
    try {
        const res = await api.get("/auth/me");
        return res.data;
    } catch (error) { throw handleApiError(error); }
  },

  acceptPolicy: async (data: { accepted: boolean; version: string }): Promise<any> => {
    try {
      const res = await api.post("/auth/accept-policy", data);
      return res.data;
    } catch (error) { throw handleApiError(error); }
  }
};

// ============================================================================
// 📋 PROJECT API ENDPOINTS (Work Hub CRM)
// ============================================================================

export const projectApi = {
  // Executive - Create Project
  createProject: async (data: CreateProjectRequest): Promise<Project> => {
    try {
        const res = await api.post("/projects/create", data);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Executive - Update Project
  updateProject: async (id: number, data: CreateProjectRequest): Promise<Project> => {
    try {
        const res = await api.put(`/projects/${id}`, data);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  updateExecutiveAdditionalData: async (id: number, data: UpdateExecutiveAdditionalDataRequest): Promise<Project> => {
    try {
        const res = await api.patch(`/projects/${id}/additional-data`, data);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Executive - Transition Stage
  transitionStage: async (id: number, data: StageTransitionRequest): Promise<Project> => {
    try {
        const res = await api.post(`/projects/${id}/transition`, data);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Executive - Delete Project (only if not onboarded)
  deleteProject: async (id: number): Promise<void> => {
    try {
        await api.delete(`/projects/${id}`);
    } catch (error) { throw handleApiError(error); }
  },

  requestProjectDeletion: async (id: number, data?: ProjectDeletionRequestCreateRequest): Promise<Project> => {
    try {
      const res = await api.post(`/projects/${id}/deletion-request`, data || {});
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  reviewProjectDeletionRequest: async (id: number, data: ProjectDeletionReviewRequest): Promise<Project> => {
    try {
      const res = await api.post(`/projects/${id}/deletion-request/review`, data);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Executive Projects
  getExecutiveProjects: async (zone?: string, statuses?: ExecutiveProjectStatus[]): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/executive${toQueryString({
          zone,
          statuses: statuses && statuses.length > 0 ? statuses.join(',') : undefined
        })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getExecutiveProjectsPaged: async (
    zone?: string,
    statuses?: ExecutiveProjectStatus[],
    searchTerm?: string,
    page = 1,
    size = 10,
    executiveId?: number
  ): Promise<PageResult<Project>> => {
    try {
        const res = await api.get(`/projects/executive/paged${toQueryString({
          zone,
          statuses: statuses && statuses.length > 0 ? statuses.join(',') : undefined,
          searchTerm: searchTerm && searchTerm.trim() ? searchTerm.trim() : undefined,
          page,
          size,
          executiveId
        })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getProjectCreationLimitStatus: async (): Promise<ProjectCreationLimitStatus> => {
    try {
      const res = await api.get('/projects/creation-limit-status');
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Universal Dashboard API - Get projects by role with viewBucket categorization
  getDashboardProjects: async (role: string, zone?: string, viewBuckets?: ProjectViewBucket[]): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/dashboard${toQueryString({
          role,
          zone,
          viewBuckets: viewBuckets && viewBuckets.length > 0 ? viewBuckets.join(',') : undefined
        })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getDashboardCompletedProjectsPaged: async (
    role: DashboardRole,
    zone?: string,
    schoolSearch?: string,
    page = 1,
    size = 10
  ): Promise<PageResult<Project>> => {
    try {
      const res = await api.get(`/projects/dashboard/completed/paged${toQueryString({
        role,
        zone,
        schoolSearch: schoolSearch && schoolSearch.trim() ? schoolSearch.trim() : undefined,
        page,
        size
      })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getDashboardProjectsCount: async (
    role: string,
    zone?: string,
    viewBuckets?: ProjectViewBucket[],
    statuses?: ExecutiveProjectStatus[]
  ): Promise<number> => {
    try {
      const res = await api.get(`/projects/dashboard/count${toQueryString({
        role,
        zone,
        viewBuckets: viewBuckets && viewBuckets.length > 0 ? viewBuckets.join(',') : undefined,
        statuses: statuses && statuses.length > 0 ? statuses.join(',') : undefined
      })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getDashboardBadgeCounts: async (role: DashboardRole, zone?: string): Promise<DashboardBadgeCounts> => {
    try {
      const res = await api.get(`/projects/dashboard/badge-counts${toQueryString({ role, zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getAdminDashboardBadgeCounts: async (role: DashboardRole, zone?: string): Promise<DashboardBadgeCounts> => {
    try {
      const res = await api.get(`/projects/dashboard/badge-counts/admin${toQueryString({ role, zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Sales - Get Projects
  getSalesProjects: async (zone?: string): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/sales${toQueryString({ zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Sales - Update Sales Data
  updateSalesData: async (id: number, data: UpdateSalesDataRequest): Promise<Project> => {
    try {
        const res = await api.put(`/projects/${id}/sales`, data);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Sales - Mark Ready for Accounts
  markReadyForAccounts: async (id: number): Promise<Project> => {
    try {
        const res = await api.post(`/projects/${id}/ready-for-accounts`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Accounts - Get Projects
  getAccountsProjects: async (zone?: string): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/accounts${toQueryString({ zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Accounts - Update Accounts Data
  updateAccountsData: async (id: number, data: UpdateAccountsDataRequest): Promise<Project> => {
    let payload = data;
    if (data.amountReceived != null && !data.paymentRequestId) {
      payload = { ...data, paymentRequestId: paymentRequestId(id, data) };
    }
    try {
        const res = await api.put(`/projects/${id}/accounts`, payload);
        if (payload.paymentRequestId) completePaymentRequest(id);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Installation - Get Projects
  getInstallationProjects: async (zone?: string, status?: string): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/installation${toQueryString({ zone, status })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Installation - Update Installation Data
  updateInstallationData: async (id: number, data: UpdateInstallationDataRequest): Promise<Project> => {
    try {
        const res = await api.put(`/projects/${id}/installation`, data);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Completed Projects
  getCompletedProjects: async (page = 1, size = 10, zone?: string): Promise<PageResult<Project>> => {
    try {
        const res = await api.get(`/projects/completed/paged${toQueryString({ page, size, zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getCompletedProjectsArchiveFiltered: async (
    zone?: string,
    searchTerm?: string,
    district?: string,
    parentCompany?: string,
    page = 1,
    size = 10
  ): Promise<PageResult<Project>> => {
    try {
      const res = await api.get(`/projects/completed/archive/filter${toQueryString({
        zone,
        searchTerm: searchTerm && searchTerm.trim() ? searchTerm.trim() : undefined,
        district,
        parentCompany,
        page,
        size
      })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  exportCompletedProjectsArchive: async (
    months = 1,
    zone?: string,
    searchTerm?: string,
    district?: string,
    parentCompany?: string
  ): Promise<Project[]> => {
    try {
      const res = await api.get(`/projects/completed/archive/export${toQueryString({
        zone,
        searchTerm: searchTerm && searchTerm.trim() ? searchTerm.trim() : undefined,
        district,
        parentCompany,
        months
      })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getFeedbackQueue: async (page = 1, size = 10, zone?: string, status?: 'PENDING' | 'NO'): Promise<PageResult<FeedbackProject>> => {
    try {
      const res = await api.get(`/projects/feedback/queue${toQueryString({ page, size, zone, status })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  updateProjectFeedback: async (id: number, feedbackCollected: boolean): Promise<Project> => {
    try {
      const res = await api.patch(`/projects/${id}/feedback`, { feedbackCollected });
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getCompletedProjectsCount: async (role?: DashboardRole, zone?: string): Promise<number> => {
    try {
      const res = await api.get(`/projects/completed/count${toQueryString({ role, zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getCompletedArchiveBadgeCounts: async (zone?: string): Promise<CompletedArchiveBadgeCounts> => {
    try {
      const res = await api.get(`/projects/completed/archive/badge-counts${toQueryString({ zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getCompletedProjectMetrics: async (zone?: string): Promise<CompletedProjectMetrics> => {
    try {
      const res = await api.get(`/projects/completed/metrics${toQueryString({ zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getProjectDeletionRequests: async (status?: string): Promise<Project[]> => {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await api.get(`/projects/deletion-requests${query}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getDroppedProjects: async (): Promise<Project[]> => {
    try {
      const res = await api.get('/projects/dropped');
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Project By ID
  getProjectById: async (id: number): Promise<Project> => {
    try {
        const res = await api.get(`/projects/${id}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Admin - Get All Projects
  getAllProjects: async (zone?: string): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/all${zone ? `?zone=${encodeURIComponent(zone)}` : ''}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Alias for getAllProjects (for API consistency)
  getAll: async (zone?: string): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/all${zone ? `?zone=${encodeURIComponent(zone)}` : ''}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Projects by Stage
  getProjectsByStage: async (stage: ProjectStage): Promise<Project[]> => {
    try {
        const res = await api.get(`/projects/stage/${stage}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

export const schoolVisitApi = {
  schedule: async (projectId: number, data: CreateSchoolVisitRequest): Promise<SchoolVisit> => {
    try {
      const res = await api.post(`/projects/${projectId}/visits`, data);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getForProject: async (projectId: number): Promise<SchoolVisit[]> => {
    try {
      const res = await api.get(`/projects/${projectId}/visits`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getForDate: async (date?: string): Promise<SchoolVisit[]> => {
    try {
      const res = await api.get(`/school-visits${toQueryString({ date })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getForAssignee: async (assignedTo: string, from?: string, to?: string): Promise<SchoolVisit[]> => {
    try {
      const res = await api.get(`/school-visits${toQueryString({ assignedTo, from, to })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  recordOutcome: async (visitId: number, data: RecordSchoolVisitOutcomeRequest): Promise<SchoolVisit> => {
    try {
      const res = await api.patch(`/school-visits/${visitId}/outcome`, data);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

// ============================================================================
// 📊 ANALYTICS API
// ============================================================================

export const analyticsApi = {
  // Get Comprehensive Dashboard Analytics (Super Admin only)
  getDashboardAnalytics: async (zone?: string): Promise<Analytics> => {
    try {
        const res = await api.get(`/analytics/dashboard${toQueryString({ zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Stage Distribution
  getStageDistribution: async (zone?: string): Promise<StageDistribution[]> => {
    try {
        const res = await api.get(`/analytics/stage-distribution${toQueryString({ zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Monthly Trends
  getMonthlyTrends: async (zone?: string): Promise<MonthlyTrend[]> => {
    try {
        const res = await api.get(`/analytics/monthly-trends${toQueryString({ zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  // Get Financial Summary
  getFinancialSummary: async (zone?: string): Promise<FinancialSummary> => {
    try {
        const res = await api.get(`/analytics/financial-summary${toQueryString({ zone })}`);
        return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

// ============================================================================
// 📑 REPORTS API
// ============================================================================

export const reportsApi = {
  getReports: async (zone?: string): Promise<ProjectTrackingReportRow[]> => {
    try {
      const res = await api.get(`/reports${toQueryString({ zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getProjectTracking: async (from: string, to: string, zone?: string, stage?: string, search?: string): Promise<ProjectTrackingReportRow[]> => {
    try {
      const res = await api.get(`/reports/projects/tracking${toQueryString({ from, to, zone, stage, search })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getProjectTrackingPageData: async (
    zone?: string,
    stage?: string,
    page = 0,
    size = 50,
    search?: string,
    from?: string,
    to?: string
  ): Promise<PageResult<ProjectTrackingReportRow>> => {
    try {
      const res = await api.get(`/reports/projects/tracking/page-data${toQueryString({ zone, stage, page, size, search, from, to })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getExecutiveActivity: async (from: string, to: string, zone?: string, executiveId?: number): Promise<ExecutiveActivityReport> => {
    try {
      const res = await api.get(`/reports/executive-activity${toQueryString({ from, to, zone, executiveId })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getPaymentAging: async (from: string, to: string, bucket?: string): Promise<PaymentAgingReportRow[]> => {
    try {
      const res = await api.get(`/reports/payments/aging${toQueryString({ from, to, bucket })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getSalesPendingCount: async (from: string, to: string): Promise<SalesPendingCount> => {
    try {
      const res = await api.get(`/reports/sales/pending-count${toQueryString({ from, to })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getAdminEmployeeStatus: async (zone?: string, userId?: number): Promise<EmployeeStatusReportRow[]> => {
    try {
      const res = await api.get(`/reports/admin/employee-status${toQueryString({ zone, userId })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

// ============================================================================
// 🏭 PRODUCTION API
// ============================================================================

export const trackingApi = {
  getExecutiveTrackingData: async (params: {
    executiveId: number;
    zone?: string;
    from?: string;
    to?: string;
  }): Promise<ExecutiveTrackingResponse> => {
    try {
      const res = await api.get(`/tracking/executive${toQueryString(params)}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getRoleBasedTrackingData: async (params: {
    role: 'SALES' | 'ACCOUNTS' | 'INSTALLATION' | 'ROLE_SALES_COORDINATOR' | 'ROLE_ACCOUNTS' | 'ROLE_INSTALLATION';
    userId?: number;
    zone?: string;
    from?: string;
    to?: string;
  }): Promise<RoleBasedTrackingResponse> => {
    try {
      const res = await api.get(`/tracking/role-based${toQueryString(params)}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getUserTrackingData: async (params: {
    role: string;
    userId?: number;
    zone?: string;
    from?: string;
    to?: string;
  }): Promise<UserTrackingData> => {
    try {
      const res = await api.get(`/tracking/user-tracking-data${toQueryString(params)}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

export const productionApi = {
  getProducts: async (): Promise<ProductionProduct[]> => {
    try {
      const res = await api.get("/production/products");
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  createProduct: async (data: CreateProductionProductRequest): Promise<ProductionProduct> => {
    try {
      const res = await api.post("/production/products", data);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getMonthlySummary: async (month: number, year: number, zone?: string, minQuantity?: number): Promise<ProductionMonthSummary> => {
    try {
      const res = await api.get(`/production/summary${toQueryString({ month, year, zone, minQuantity })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getHistory: async (from: string, to: string, zone?: string, minQuantity?: number): Promise<ProductionEntry[]> => {
    try {
      const res = await api.get(`/production/history${toQueryString({ from, to, zone, minQuantity })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  saveMonthlySummary: async (data: SaveMonthlyProductionRequest): Promise<ProductionMonthSummary> => {
    try {
      const res = await api.put("/production/summary", data);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getYearlyTrend: async (year: number, zone?: string): Promise<ProductionTrend[]> => {
    try {
      const res = await api.get(`/production/trends${toQueryString({ year, zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

// ============================================================================
// 🧾 ACTIVITY LOG API
// ============================================================================

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const activityApi = {
  getMyStatement: async (from?: string, to?: string): Promise<UserActivityStatement> => {
    try {
      const res = await api.get(`/activity/me${toQueryString({ from, to })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getUserStatement: async (userId: number, from?: string, to?: string): Promise<UserActivityStatement> => {
    try {
      const res = await api.get(`/activity/statement/${userId}${toQueryString({ from, to })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getUserActivities: async (userId: number, from?: string, to?: string, page = 0, size = 50): Promise<PageResult<UserActivityLog>> => {
    try {
      const res = await api.get(`/activity/user/${userId}${toQueryString({ from, to, page, size })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getRoleActivities: async (role: string, from?: string, to?: string, page = 0, size = 50): Promise<PageResult<UserActivityLog>> => {
    try {
      const res = await api.get(`/activity/role/${encodeURIComponent(role)}${toQueryString({ from, to, page, size })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getEntityActivities: async (entityType: ActivityEntityType, entityId: number, from?: string, to?: string): Promise<UserActivityLog[]> => {
    try {
      const res = await api.get(`/activity/entity/${entityType}/${entityId}${toQueryString({ from, to })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};

export const auditLogsApi = {
  getAuditLogs: async (
    fromDate?: string,
    toDate?: string,
    zone?: string,
    category?: AuditCategory,
    events?: string[],
    page = 1,
    size = 10,
    actorEmail?: string
  ): Promise<PageResult<AuditLogRow>> => {
    try {
      const res = await api.get(`/audit-logs${toQueryString({
        fromDate,
        toDate,
        zone,
        category,
        events: events && events.length > 0 ? events.join(',') : undefined,
        actorEmail,
        page,
        size
      })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  },

  getActivityCounts: async (zone?: string): Promise<AuditActivityCounts> => {
    try {
      const res = await api.get(`/audit-logs/counts${toQueryString({ zone })}`);
      return res.data.data;
    } catch (error) { throw handleApiError(error); }
  }
};
