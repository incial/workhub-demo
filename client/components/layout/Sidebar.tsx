import React, { useRef, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import { LogOut, X, FolderKanban, DollarSign, CreditCard, Wrench, Archive, BarChart3, FileText, Factory, Activity, TableProperties, MessageSquareQuote } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { useOperatorView } from '../../context/OperatorViewContext';
import { ImageConfig } from '../../constants/images';
import { safeDemoImage } from '../../demo/network';
import { scopedUiKey } from '../../demo/session';
import { formatRoleLabel } from '../../utils/roleLabel';

const NavItem = ({ icon: Icon, label, to, active, collapsed }: { icon: any, label: string, to: string, active: boolean, collapsed: boolean }) => (
  <Link
    to={to}
    aria-label={label}
    className={`relative group flex items-center mb-2 lg:mb-3 rounded-xl lg:rounded-2xl transition-all duration-300 ease-out overflow-hidden ${
      collapsed ? 'justify-center h-14 lg:h-16 w-full' : 'px-4 lg:px-5 py-3 lg:py-4 w-full'
    } ${
      active 
        ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20' 
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {active && (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/40 to-transparent opacity-50" />
    )}

    <div className={`flex items-center relative z-10 ${collapsed ? 'justify-center' : 'gap-4 lg:gap-5'} w-full`}>
        <Icon 
            className={`
                ${collapsed ? 'h-6 w-6 lg:h-7 lg:w-7' : 'h-5 w-5 lg:h-6 lg:w-6'} 
                transition-all duration-500 shrink-0
                ${active ? 'text-indigo-400 scale-105' : 'text-slate-500 group-hover:text-indigo-300'}
            `} 
            strokeWidth={active ? 2.5 : 2}
        />
        
        {!collapsed && (
            <span className={`text-sm lg:text-[15px] tracking-tight truncate ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
            </span>
        )}

        {active && !collapsed && (
            <div className="ml-auto flex items-center">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.55)]" />
            </div>
        )}
    </div>
  </Link>
);

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const { effectiveRole } = useOperatorView();
    const { isSidebarCollapsed, isMobileSidebarOpen, closeMobileSidebar, setShowSidebar } = useLayout();
    const currentPath = location.pathname;
    const [avatarErrored, setAvatarErrored] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const savedScroll = sessionStorage.getItem(scopedUiKey('sidebarScroll'));
        if (savedScroll && scrollRef.current) {
            scrollRef.current.scrollTop = Number(savedScroll);
        }
    }, []);

    const handleScroll = () => {
        if (scrollRef.current) {
            sessionStorage.setItem(scopedUiKey('sidebarScroll'), String(scrollRef.current.scrollTop));
        }
    };
    
    const role = effectiveRole || user?.role;
    const isSuperAdmin = role === 'ROLE_SUPER_ADMIN';
    const isAdmin = role === 'ROLE_ADMIN';
    const isEmployee = role === 'ROLE_EMPLOYEE' || isAdmin;
    const isExecutive = role === 'ROLE_EXECUTIVE' || isAdmin;
    const isSales = role === 'ROLE_SALES_COORDINATOR' || isAdmin;
    const isAccounts = role === 'ROLE_ACCOUNTS' || isAdmin;
    const isInstallation = role === 'ROLE_INSTALLATION' || isAdmin;
    const isFeedback = role === 'ROLE_FEEDBACK';
    const canUseFeedbackWorkspace = isFeedback || isAdmin;
    const isProduction = role === 'ROLE_PRODUCTION' || isAdmin;
    const fallbackAvatar = useMemo(() => ImageConfig.logo, []);
    const avatarSrc = safeDemoImage(!avatarErrored && user?.avatarUrl ? user.avatarUrl : fallbackAvatar);
    const displayName = (user?.name || user?.email || 'User').split(' ')[0];

    useEffect(() => {
        setAvatarErrored(false);
    }, [user?.avatarUrl]);

    // Count visible navigation items
    let navItemCount = 0;
    if (isSuperAdmin) {
        navItemCount = 5; // Dashboard + Reports + Tracking + Data Bank + Audit Logs
    } else {
        if (isAdmin) navItemCount++;        // Dashboard
        if (isExecutive) navItemCount += 1;  // Projects
        if (isSales) navItemCount++;         // Sales
        if (isAccounts) navItemCount++;      // Accounts
        if (isInstallation) navItemCount++;  // Installation
        if (canUseFeedbackWorkspace) navItemCount++; // Feedback workspace
        if (isProduction) navItemCount++;    // Procurement
        if (isAdmin && !isExecutive && !isSales && !isAccounts && !isInstallation) {
            // Pure admin (not combined with other roles) gets Completed
            navItemCount += 2; // Completed + Audit Logs
        }
    }

    // Update context with sidebar visibility
    useLayoutEffect(() => {
        const shouldShow = navItemCount > 1 || isMobileSidebarOpen || isFeedback;
        setShowSidebar(shouldShow);
    }, [isFeedback, navItemCount, isMobileSidebarOpen, setShowSidebar]);

    // Auto-hide sidebar if only 1 navigation item (no navigation needed)
    // Still show on mobile when explicitly opened
    if (navItemCount <= 1 && !isMobileSidebarOpen && !isFeedback) {
        return null;
    }

  return (
    <>
        {/* Mobile Backdrop */}
        {isMobileSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-300"
                onClick={closeMobileSidebar}
            />
        )}

        <aside 
            className={`fixed top-0 bottom-0 left-0 z-[99] flex flex-col p-2 lg:p-4 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            } ${
                isSidebarCollapsed ? 'w-24 lg:w-28' : 'w-[92vw] max-w-[22rem] sm:w-80'
            }`}
        >
        <div className="h-full bg-slate-950 rounded-[2rem] lg:rounded-[3rem] flex flex-col overflow-hidden border border-white/10 shadow-xl relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_70%)] pointer-events-none" />

            <div className={`pt-8 lg:pt-12 pb-6 lg:pb-10 flex items-center relative z-10 transition-all duration-500 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-6 lg:px-10 justify-between'}`}>
                <div className="flex items-center gap-4 lg:gap-5 group cursor-pointer text-white">
                    <div className="relative flex items-center justify-center rounded-2xl lg:rounded-[1.75rem] bg-white h-10 w-10 lg:h-14 lg:w-14 shadow-md overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-200">
                        <img src={ImageConfig.logo} alt="Incial" className="h-7 w-7 lg:h-10 lg:w-10 object-contain" />
                    </div>
                    {!isSidebarCollapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-white font-black text-xl lg:text-2xl tracking-tighter leading-none">WorkHub</span>
                            <span className="text-[9px] lg:text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mt-1 lg:mt-2">MARK VI OS</span>
                        </div>
                    )}
                </div>
                {/* Mobile Close Button */}
                {!isSidebarCollapsed && (
                    <button onClick={closeMobileSidebar} className="lg:hidden p-2 text-slate-400 hover:text-white">
                        <X className="h-6 w-6" />
                    </button>
                )}
            </div>

            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 lg:px-4 space-y-8 lg:space-y-12 relative z-10" 
                onClick={() => window.innerWidth < 1024 && closeMobileSidebar()}
            >
                {isSuperAdmin ? (
                    // Super Admin Navigation
                    <div className="space-y-1 lg:space-y-2">
                        {!isSidebarCollapsed && (
                            <p className="px-4 lg:px-6 text-[10px] lg:text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3 lg:mb-6">Analytics & Insights</p>
                        )}
                        <NavItem collapsed={isSidebarCollapsed} icon={BarChart3} label="Dashboard" to="/dashboard" active={currentPath.startsWith('/dashboard')} />
                        <NavItem collapsed={isSidebarCollapsed} icon={FileText} label="Reports" to="/reports" active={currentPath.startsWith('/reports')} />
                        <NavItem collapsed={isSidebarCollapsed} icon={TableProperties} label="Tracking" to="/tracking" active={currentPath.startsWith('/tracking')} />
                        <NavItem collapsed={isSidebarCollapsed} icon={Archive} label="Data Bank" to="/completed" active={currentPath.startsWith('/completed')} />
                        <NavItem collapsed={isSidebarCollapsed} icon={Activity} label="Audit Logs" to="/audit-logs" active={currentPath.startsWith('/audit-logs')} />
                    </div>
                ) : (
                    // Admin and Other Roles - Operational Pages
                    <div className="space-y-1 lg:space-y-2">
                        {!isSidebarCollapsed && (
                            <p className="px-4 lg:px-6 text-[10px] lg:text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3 lg:mb-6">Core Operations</p>
                        )}
                        
                        {isAdmin && <NavItem collapsed={isSidebarCollapsed} icon={BarChart3} label="Dashboard" to="/dashboard" active={currentPath.startsWith('/dashboard')} />}
                        {isExecutive && <NavItem collapsed={isSidebarCollapsed} icon={FolderKanban} label="Executive" to="/projects" active={currentPath.startsWith('/projects')} />}
                        {isSales && <NavItem collapsed={isSidebarCollapsed} icon={DollarSign} label="Billing" to="/sales" active={currentPath.startsWith('/sales')} />}
                        {isAccounts && <NavItem collapsed={isSidebarCollapsed} icon={CreditCard} label="Accounts" to="/accounts" active={currentPath.startsWith('/accounts')} />}
                        {isInstallation && <NavItem collapsed={isSidebarCollapsed} icon={Wrench} label="Installation" to="/installation" active={currentPath.startsWith('/installation')} />}
                        {isProduction && <NavItem collapsed={isSidebarCollapsed} icon={Factory} label="Procurement" to="/procurement" active={currentPath.startsWith('/procurement')} />}
                        {(isAdmin || isSuperAdmin) && <NavItem collapsed={isSidebarCollapsed} icon={Archive} label="Data Bank" to="/completed" active={currentPath.startsWith('/completed')} />}

                        {canUseFeedbackWorkspace && (
                            <div className="pt-6 lg:pt-8">
                                {!isSidebarCollapsed && (
                                    <p className="px-4 lg:px-6 text-[10px] lg:text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3 lg:mb-6">Feedback</p>
                                )}
                                <NavItem collapsed={isSidebarCollapsed} icon={MessageSquareQuote} label="Feedback" to="/feedback" active={currentPath.startsWith('/feedback')} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-auto p-3 lg:p-4 space-y-4 lg:space-y-5 relative z-10 bg-slate-950 border-t border-white/5 overflow-hidden">
                <div className="flex flex-col gap-2 lg:gap-3">
                    <div className={`flex items-center rounded-2xl bg-white/5 border border-white/5 transition-all duration-500 ${isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 lg:gap-4 p-2 lg:p-2.5'}`}>
                        <div className="relative group/avatar shrink-0">
                            <img 
                                src={avatarSrc} 
                                referrerPolicy="no-referrer"
                                onError={() => setAvatarErrored(true)}
                                className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl object-cover shadow-2xl border border-white/10 group-hover/avatar:scale-105 transition-transform" 
                                alt="User" 
                            />
                            <div className="absolute -bottom-1 -right-1 h-3 w-3 lg:h-4 lg:w-4 bg-emerald-500 border-2 border-slate-950 rounded-full shadow-sm" />
                        </div>
                        
                        {!isSidebarCollapsed && (
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-white text-sm lg:text-[15px] font-bold truncate leading-none mb-1 lg:mb-1.5">{displayName}</span>
                                <span className="text-[9px] lg:text-[10px] text-indigo-400 uppercase font-black tracking-widest leading-none">{formatRoleLabel(role)}</span>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={logout}
                        className={`flex items-center w-full rounded-2xl text-rose-400 hover:bg-rose-50/10 transition-colors group ${isSidebarCollapsed ? 'justify-center p-3 lg:p-4' : 'gap-3 lg:gap-4 px-4 lg:px-6 py-3 lg:py-4'}`}
                    >
                        <LogOut className="h-5 w-5 lg:h-6 lg:w-6 shrink-0 group-hover:scale-105 transition-transform" />
                        {!isSidebarCollapsed && <span className="text-xs lg:text-[13px] font-bold">Terminate Session</span>}
                    </button>
                </div>
            </div>
        </div>
        </aside>
    </>
  );
};
