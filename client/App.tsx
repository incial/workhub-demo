import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LayoutProvider } from './context/LayoutContext';
import { ZoneProvider } from './context/ZoneContext';
import { OperatorViewProvider, useOperatorView } from './context/OperatorViewContext';
import { requiresPolicyConsent } from './utils/policyConsent';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ExecutivePage = lazy(() => import('./pages/ExecutivePage').then((module) => ({ default: module.ExecutivePage })));
const SalesCoordinatorPage = lazy(() => import('./pages/SalesCoordinatorPage').then((module) => ({ default: module.SalesCoordinatorPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((module) => ({ default: module.AccountsPage })));
const InstallationPage = lazy(() => import('./pages/InstallationPage').then((module) => ({ default: module.InstallationPage })));
const WorkCompletedPage = lazy(() => import('./pages/WorkCompletedPage').then((module) => ({ default: module.WorkCompletedPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const ExecutiveActivityReportPage = lazy(() => import('./pages/ExecutiveActivityReportPage').then((module) => ({ default: module.ExecutiveActivityReportPage })));
const ProjectTrackingPage = lazy(() => import('./pages/ProjectTrackingPage').then((module) => ({ default: module.ProjectTrackingPage })));
const ProductionPage = lazy(() => import('./pages/ProductionPage').then((module) => ({ default: module.ProductionPage })));
const ActivityExplorerPage = lazy(() => import('./pages/ActivityExplorerPage').then((module) => ({ default: module.ActivityExplorerPage })));
const UniversalCalendarPage = lazy(() => import('./pages/UniversalCalendarPage').then((module) => ({ default: module.UniversalCalendarPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const OperatorPage = lazy(() => import('./pages/OperatorPage').then((module) => ({ default: module.OperatorPage })));
const ConsentPage = lazy(() => import('./pages/ConsentPage').then((module) => ({ default: module.ConsentPage })));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage').then((module) => ({ default: module.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })));
const Screensaver = lazy(() => import('./components/ui/Screensaver').then((module) => ({ default: module.Screensaver })));

const RouteLoader: React.FC = () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />
            <span className="text-sm font-semibold text-slate-600">Loading workspace...</span>
        </div>
    </div>
);

// Super Admin Route - For Analytics Dashboard Only
const SuperAdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_SUPER_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Admin Route - For CRM/Pipeline and operational overview pages
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Executive Route - For Project Management
const ExecutiveRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_EXECUTIVE' || effectiveRole === 'ROLE_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Sales Route - For Sales Coordinator
const SalesRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_SALES_COORDINATOR' || effectiveRole === 'ROLE_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Accounts Route - For Accounts Department
const AccountsRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_ACCOUNTS' || effectiveRole === 'ROLE_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Installation Route - For Installation Team (ADMIN only, not SUPER_ADMIN)
const InstallationRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_INSTALLATION' || effectiveRole === 'ROLE_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Operational Route (SA + Admin + Employee) - For Companies/Registry
const OperationalRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_CLIENT') {
        return <Navigate to="/unauthorized" replace />;
    }
    return children;
};

// Admin / Super Admin / Operator route
const AdminAndSuperAdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;

    if (effectiveRole === 'ROLE_ADMIN' || effectiveRole === 'ROLE_SUPER_ADMIN' || effectiveRole === 'ROLE_OPERATOR') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

const FeedbackRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_FEEDBACK' || effectiveRole === 'ROLE_ADMIN') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Reports Route - Super Admin + Operator only (Admin explicitly blocked)
const ReportsRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_SUPER_ADMIN' || effectiveRole === 'ROLE_OPERATOR') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

const AuditLogsRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_SUPER_ADMIN' || effectiveRole === 'ROLE_ADMIN' || effectiveRole === 'ROLE_OPERATOR') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

// Production Route - Production team + Admin + Operator
const ProductionRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;

    if (effectiveRole === 'ROLE_PRODUCTION' || effectiveRole === 'ROLE_ADMIN' || effectiveRole === 'ROLE_SUPER_ADMIN' || effectiveRole === 'ROLE_OPERATOR') {
        return children;
    }
    return <Navigate to="/unauthorized" replace />;
};

const OperatorRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    if (effectiveRole === 'ROLE_OPERATOR') return children;
    return <Navigate to="/" replace />;
};

// Public Route (Redirects to appropriate page if already logged in)
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    if (isAuthenticated) {
        if (requiresPolicyConsent(user)) {
            return <Navigate to="/consent" replace />;
        }
        // Use root redirect which handles role-based routing
        return <Navigate to="/" replace />;
    }
    return children;
};

const ConsentRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!requiresPolicyConsent(user)) return <Navigate to="/" replace />;
    return children;
};

// Root Redirect Logic - Routes users to appropriate default page based on role
const RootRedirect: React.FC = () => {
    const { isAuthenticated, user } = useAuth();
    const { effectiveRole } = useOperatorView();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiresPolicyConsent(user)) return <Navigate to="/consent" replace />;
    
    // Route based on user role to their primary workspace
    const role = effectiveRole || user?.role;
    
    switch (role) {
        case 'ROLE_SUPER_ADMIN':
            // Super Admin goes to analytics dashboard
            return <Navigate to="/dashboard" replace />;
        
        case 'ROLE_ADMIN':
            // Admin opens on the same dashboard view used by Super Admin
            return <Navigate to="/dashboard" replace />;
        
        case 'ROLE_EXECUTIVE':
            return <Navigate to="/projects" replace />;
        
        case 'ROLE_SALES_COORDINATOR':
            return <Navigate to="/sales" replace />;
        
        case 'ROLE_ACCOUNTS':
            return <Navigate to="/accounts" replace />;
        
        case 'ROLE_INSTALLATION':
            return <Navigate to="/installation" replace />;

        case 'ROLE_FEEDBACK':
            return <Navigate to="/feedback" replace />;

        case 'ROLE_PRODUCTION':
            return <Navigate to="/production" replace />;

        case 'ROLE_ZONAL_MANAGER':
            return <Navigate to="/profile" replace />;
        
        case 'ROLE_EMPLOYEE':
            return <Navigate to="/profile" replace />;
        
        case 'ROLE_CLIENT':
            // Clients have limited access - redirect to unauthorized
            return <Navigate to="/unauthorized" replace />;
        case 'ROLE_OPERATOR':
            return <Navigate to="/operator" replace />;
        
        default:
            // Fallback for unknown roles
            return <Navigate to="/projects" replace />;
    }
};

const AppRoutes = () => {
    const { isAuthenticated } = useAuth();
    return (
        <Routes>
            <Route path="/demo" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
            {/* Public Routes */}
            <Route path="/login" element={
                <PublicRoute>
                    <LoginPage />
                </PublicRoute>
            } />

            <Route path="/forgot-password" element={
                <PublicRoute>
                    <ForgotPasswordPage />
                </PublicRoute>
            } />

            <Route path="/consent" element={
                <ConsentRoute>
                    <ConsentPage />
                </ConsentRoute>
            } />

            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            
            {/* Dashboard - Admin + Super Admin */}
            <Route path="/dashboard" element={
                <AdminAndSuperAdminRoute>
                    <DashboardPage />
                </AdminAndSuperAdminRoute>
            } />
            
            {/* Reports - Super Admin + Operator */}
            <Route path="/reports" element={
                <ReportsRoute>
                    <ReportsPage />
                </ReportsRoute>
            } />
            
            {/* Projects - Executive Module */}
            <Route path="/projects" element={
                <ExecutiveRoute>
                    <ExecutivePage />
                </ExecutiveRoute>
            } />

            <Route path="/operator" element={
                <OperatorRoute>
                    <OperatorPage />
                </OperatorRoute>
            } />

            <Route path="/calendar" element={
                <ExecutiveRoute>
                    <UniversalCalendarPage />
                </ExecutiveRoute>
            } />

            <Route path="/tracking" element={
                <AdminAndSuperAdminRoute>
                    <ProjectTrackingPage />
                </AdminAndSuperAdminRoute>
            } />

            <Route path="/executive-activity-report" element={
                <AdminAndSuperAdminRoute>
                    <ExecutiveActivityReportPage />
                </AdminAndSuperAdminRoute>
            } />

            <Route path="/profile" element={
                <OperationalRoute>
                    <ProfilePage />
                </OperationalRoute>
            } />

            <Route path="/production" element={
                <ProductionRoute>
                    <ProductionPage />
                </ProductionRoute>
            } />

            <Route path="/audit-logs" element={
                <AuditLogsRoute>
                    <ActivityExplorerPage />
                </AuditLogsRoute>
            } />

            <Route path="/activity/explorer" element={<Navigate to="/audit-logs" replace />} />
            
            {/* Sales Coordinator Module */}
            <Route path="/sales" element={
                <SalesRoute>
                    <SalesCoordinatorPage />
                </SalesRoute>
            } />
            
            {/* Accounts Module */}
            <Route path="/accounts" element={
                <AccountsRoute>
                    <AccountsPage />
                </AccountsRoute>
            } />
            
            {/* Installation Module */}
            <Route path="/installation" element={
                <InstallationRoute>
                    <InstallationPage />
                </InstallationRoute>
            } />

            <Route path="/feedback" element={
                <FeedbackRoute>
                    <FeedbackPage />
                </FeedbackRoute>
            } />
            
            {/* Work Completed Archive - Admin + Super Admin */}
            <Route path="/completed" element={
                <AdminAndSuperAdminRoute>
                    <WorkCompletedPage />
                </AdminAndSuperAdminRoute>
            } />
            
            {/* System Routes */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Catch All - Order Matters */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

const App: React.FC = () => {
  // Prevent mouse wheel from changing number input values globally
  useEffect(() => {
    const preventNumberInputWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        e.preventDefault();
      }
    };
    
    document.addEventListener('wheel', preventNumberInputWheel, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', preventNumberInputWheel);
    };
  }, []);

  return (
    <AuthProvider>
        <ToastProvider>
            <OperatorViewProvider>
                <ZoneProvider>
                    <LayoutProvider>
                        <HashRouter>
                            <AppErrorBoundary>
                                <Suspense fallback={<RouteLoader />}>
                                    <AppRoutes />
                                    <Screensaver />
                                </Suspense>
                            </AppErrorBoundary>
                        </HashRouter>
                    </LayoutProvider>
                </ZoneProvider>
            </OperatorViewProvider>
        </ToastProvider>
    </AuthProvider>
  );
};

export default App;
