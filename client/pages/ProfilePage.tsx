import React, { useEffect, useMemo, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { authApi, usersApi } from '../services/api';
import { CheckCircle2, Clock3, Mail, MapPin, Pencil, ShieldCheck, X } from 'lucide-react';
import { ChangePasswordModal } from '../components/profile/ChangePasswordModal';
import { User } from '../types';
import { formatZoneLabel } from '../utils';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOperatorView } from '../context/OperatorViewContext';
import { safeDemoImage } from '../demo/network';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const { isSidebarCollapsed, showSidebar } = useLayout();
  const { effectiveRole } = useOperatorView();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<User | null>(user);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const latest = await authApi.getCurrentUser();
        setProfileUser(latest);
      } catch {
        setProfileUser(user);
      }
    };
    loadCurrentUser();
  }, [user]);

  useEffect(() => {
    setEditableName(profileUser?.name || '');
  }, [profileUser?.name]);

  const roleLabel = useMemo(() => (profileUser?.role || '').replace('ROLE_', '').replaceAll('_', ' '), [profileUser?.role]);
  const showExecutiveZone = profileUser?.role === 'ROLE_EXECUTIVE';
  const profileReturnPath = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from !== '/profile') {
      return from;
    }
    const role = effectiveRole || user?.role;
    switch (role) {
      case 'ROLE_SUPER_ADMIN':
        return '/dashboard';
      case 'ROLE_ADMIN':
      case 'ROLE_EXECUTIVE':
        return '/projects';
      case 'ROLE_SALES_COORDINATOR':
        return '/sales';
      case 'ROLE_ACCOUNTS':
        return '/accounts';
      case 'ROLE_INSTALLATION':
        return '/installation';
      case 'ROLE_PRODUCTION':
        return '/production';
      case 'ROLE_OPERATOR':
        return '/operator';
      default:
        return '/';
    }
  }, [effectiveRole, location.state, user?.role]);

  const handleSaveName = async () => {
    const normalizedName = editableName.trim();
    if (!normalizedName) {
      showToast('Name must not be empty', 'error');
      return;
    }
    try {
      setSavingName(true);
      const updated = await usersApi.updateMyName(normalizedName);
      setProfileUser(updated);
      updateUser({ name: updated.name });
      setIsEditingName(false);
      showToast('Name updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update name', 'error');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="flex min-h-screen mesh-bg relative">
      <div className="glass-canvas" />
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
        <Navbar />
        <main className="px-4 lg:px-12 py-6 lg:py-10 pb-32">
          <div className="max-w-6xl mx-auto space-y-6">
            <section className="glass-panel rounded-3xl p-6 lg:p-10 border border-white/50 shadow-premium">
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => navigate(profileReturnPath)}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
                  aria-label="Close profile"
                  title="Close profile"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="h-28 w-28 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 p-1 shadow-xl">
                  <div className="h-full w-full rounded-full bg-white overflow-hidden flex items-center justify-center text-4xl font-black text-brand-700">
                    {profileUser?.avatarUrl ? <img src={safeDemoImage(profileUser.avatarUrl)} alt={profileUser.name} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : profileUser?.name?.charAt(0)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {isEditingName ? (
                      <input
                        type="text"
                        value={editableName}
                        onChange={(e) => setEditableName(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-2xl lg:text-3xl font-black text-slate-900 tracking-tight w-full max-w-xl"
                      />
                    ) : (
                      <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{profileUser?.name}</h1>
                    )}
                    <button
                      onClick={() => {
                        if (!isEditingName) {
                          setEditableName(profileUser?.name || '');
                          setIsEditingName(true);
                        }
                      }}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-700 hover:border-blue-300"
                      title="Edit name"
                      disabled={isEditingName}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isEditingName && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditableName(profileUser?.name || '');
                            setIsEditingName(false);
                          }}
                          disabled={savingName}
                          className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveName}
                          disabled={savingName}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                        >
                          {savingName ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 mt-2 flex items-center gap-2"><Mail className="h-4 w-4" /> {profileUser?.email}</p>
                  <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-700">Active</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={`grid grid-cols-2 md:grid-cols-2 ${showExecutiveZone ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-2 sm:gap-4`}>
              <div className="glass-panel rounded-2xl p-3 sm:p-5 border border-white/50">
                <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Name</p>
                <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1 sm:mt-2 truncate">{profileUser?.name}</p>
              </div>
              <div className="glass-panel rounded-2xl p-3 sm:p-5 border border-white/50">
                <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Email</p>
                <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1 sm:mt-2 break-all">{profileUser?.email}</p>
              </div>
              <div className="glass-panel rounded-2xl p-3 sm:p-5 border border-white/50">
                <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Role</p>
                <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1 sm:mt-2 truncate">{roleLabel || '-'}</p>
              </div>
              {showExecutiveZone && (
                <div className="glass-panel rounded-2xl p-3 sm:p-5 border border-white/50">
                  <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Zone</p>
                  <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1 sm:mt-2 flex items-center gap-1 sm:gap-2 truncate"><MapPin className="h-3 w-3 sm:h-4 w-4 text-brand-600 shrink-0" /> {formatZoneLabel(profileUser?.zone)}</p>
                </div>
              )}
            </section>

            <section className="glass-panel rounded-3xl p-6 lg:p-8 border border-white/50">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-[0.2em]">Reset Password</h2>
              </div>
              <p className="text-slate-600 mb-6">Reset your password with current-password verification and OTP confirmation.</p>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-[0.15em] transition-all"
              >
                <Clock3 className="h-4 w-4" />
                Reset Password
              </button>
            </section>
          </div>
        </main>
      </div>

      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
    </div>
  );
};
