import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Shield, Sparkles, UserRound, Users, UserPlus2 } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useToast } from '../context/ToastContext';
import { usersApi } from '../services/api';
import { User, UserRole, Zone } from '../types';
import { ActorHoverCard, HoveredActorCardState } from '../components/ui/ActorHoverCard';
import { safeDemoImage } from '../demo/network';
import { formatRoleLabel } from '../utils/roleLabel';

const CREATE_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'ROLE_EXECUTIVE', label: 'Executive' },
  { value: 'ROLE_ACCOUNTS', label: 'Accounts' },
  { value: 'ROLE_FEEDBACK', label: 'Feedback' },
  { value: 'ROLE_INSTALLATION', label: 'Installation' },
  { value: 'ROLE_PRODUCTION', label: 'Procurement' },
  { value: 'ROLE_SALES_COORDINATOR', label: 'Sales Coordinator' }
];

const ZONES: Zone[] = ['ZONE_1', 'ZONE_2', 'ZONE_3'];
const USER_CARD_WIDTH = 288;
const USER_CARD_GAP = 10;
const USER_CARD_VIEWPORT_PADDING = 16;
const USER_CARD_SAFE_TOP = 220;
const USER_REGISTRY_ROLE_ORDER: Record<string, number> = {
  ROLE_SUPER_ADMIN: 1,
  ROLE_ADMIN: 2,
  ROLE_EXECUTIVE: 3,
  ROLE_SALES_COORDINATOR: 4,
  ROLE_ACCOUNTS: 5,
  ROLE_INSTALLATION: 6,
  ROLE_FEEDBACK: 7,
  ROLE_PRODUCTION: 8
};
const USER_REGISTRY_ZONE_ORDER: Record<string, number> = {
  ZONE_1: 1,
  ZONE_2: 2,
  ZONE_3: 3
};

const formatZoneLabel = (zone?: Zone | null) => (zone ? zone.replace('_', ' ') : 'GLOBAL');
const NON_EXECUTIVE_ZONE_LABEL = 'GLOBAL';

export const OperatorPage: React.FC = () => {
  const { isSidebarCollapsed, showSidebar } = useLayout();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ROLE_EXECUTIVE');
  const [zone, setZone] = useState<Zone>('ZONE_1');
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
  const [hoveredActorCard, setHoveredActorCard] = useState<HoveredActorCardState | null>(null);

  const roleRequiresZone = role === 'ROLE_EXECUTIVE';

  const registryUsers = useMemo(
    () =>
      users
        .filter((user) => user.role !== 'ROLE_OPERATOR')
        .sort((a, b) => {
          const roleOrderDiff =
            (USER_REGISTRY_ROLE_ORDER[a.role] || Number.MAX_SAFE_INTEGER) -
            (USER_REGISTRY_ROLE_ORDER[b.role] || Number.MAX_SAFE_INTEGER);

          if (roleOrderDiff !== 0) {
            return roleOrderDiff;
          }

          if (a.role === 'ROLE_EXECUTIVE' && b.role === 'ROLE_EXECUTIVE') {
            const zoneOrderDiff =
              (USER_REGISTRY_ZONE_ORDER[a.zone || ''] || Number.MAX_SAFE_INTEGER) -
              (USER_REGISTRY_ZONE_ORDER[b.zone || ''] || Number.MAX_SAFE_INTEGER);

            if (zoneOrderDiff !== 0) {
              return zoneOrderDiff;
            }
          }

          const nameDiff = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
          if (nameDiff !== 0) {
            return nameDiff;
          }

          return (a.email || '').localeCompare(b.email || '', undefined, { sensitivity: 'base' });
        }),
    [users]
  );

  const executiveUsersCount = useMemo(
    () => registryUsers.filter((user) => user.role === 'ROLE_EXECUTIVE').length,
    [registryUsers]
  );

  const globalUsersCount = useMemo(
    () => registryUsers.filter((user) => !user.zone).length,
    [registryUsers]
  );

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const resetCreateForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('ROLE_EXECUTIVE');
    setZone('ZONE_1');
  };

  const onCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (!email.trim()) {
      showToast('Email is required', 'error');
      return;
    }
    if (roleRequiresZone && !zone) {
      showToast('Zone is required for executive users', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password || undefined,
        role,
        zone: roleRequiresZone ? zone : undefined
      });
      showToast('User created successfully', 'success');
      resetCreateForm();
      await loadUsers();
    } catch (error: any) {
      showToast(error.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    if (nextRole !== 'ROLE_EXECUTIVE') {
      setZone('ZONE_1');
    }
  };

  const openDeleteModal = (user: User) => setPendingDeleteUser(user);
  const closeDeleteModal = () => setPendingDeleteUser(null);

  const onDeleteUser = async () => {
    if (!pendingDeleteUser?.id) return;
    try {
      await usersApi.delete(pendingDeleteUser.id);
      showToast('User deleted successfully', 'success');
      closeDeleteModal();
      await loadUsers();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete user', 'error');
    }
  };

  const showUserHoverCard = (event: React.MouseEvent<HTMLElement>, user: User) => {
    const anchor = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const left = Math.min(
      Math.max(anchor.left, USER_CARD_VIEWPORT_PADDING),
      Math.max(USER_CARD_VIEWPORT_PADDING, viewportWidth - USER_CARD_WIDTH - USER_CARD_VIEWPORT_PADDING)
    );
    const shouldRenderBelow = anchor.top < USER_CARD_SAFE_TOP;
    const top = shouldRenderBelow ? anchor.bottom + USER_CARD_GAP : anchor.top - USER_CARD_GAP;
    setHoveredActorCard({
      actor: {
        name: user.name,
        email: user.email,
        role: user.role,
        zone: user.zone || undefined,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      },
      top,
      left,
      placement: shouldRenderBelow ? 'bottom' : 'top'
    });
  };

  return (
    <div className="relative flex min-h-screen mesh-bg">
      <div className="glass-canvas" />
      <Sidebar />
      <div className={`flex-1 flex min-w-0 flex-col transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
        <Navbar />
        <main className="custom-scrollbar space-y-6 overflow-y-auto px-4 py-5 pb-24 lg:px-10 lg:py-8">
          <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.18)]">
            <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_58%,#2563eb_100%)] px-6 py-7 text-white sm:px-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-blue-100">
                <Shield className="h-3.5 w-3.5" />
                Operator Console
              </div>
              <h1 className="text-3xl font-black tracking-[-0.04em] lg:text-4xl">Operator Control Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100/90">
                Provision internal users from one polished workspace. Executive accounts carry zone ownership. Sales, accounts, installation, feedback, production, and admin-facing roles are created as shared global users.
              </p>
            </div>
            <div className="grid gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:grid-cols-3 sm:px-8">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Total Users</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{registryUsers.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Executives</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{executiveUsersCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Global Users</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{globalUsersCount}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)] sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-700">
                  <UserPlus2 className="h-3.5 w-3.5" />
                  Create User
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-900">Provision a new team member</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Name is mandatory. Zone is only required when the selected role is Executive.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                Leave the password blank to let the user choose one through Forgot Password.
              </div>
            </div>

            <form onSubmit={onCreateUser} className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  placeholder="user@incial.com"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Role <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="w-full appearance-none rounded-2xl border border-indigo-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,244,255,0.9))] px-4 py-3 pr-10 text-sm font-semibold text-slate-800 shadow-[0_12px_28px_-24px_rgba(37,99,235,0.45)] outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  >
                    {CREATE_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                </div>
              </div>

              {roleRequiresZone ? (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Zone <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      value={zone}
                      onChange={(e) => setZone(e.target.value as Zone)}
                      className="w-full appearance-none rounded-2xl border border-indigo-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,244,255,0.9))] px-4 py-3 pr-10 text-sm font-semibold text-slate-800 shadow-[0_12px_28px_-24px_rgba(37,99,235,0.45)] outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    >
                      {ZONES.map((value) => (
                        <option key={value} value={value}>
                          {formatZoneLabel(value)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">Executive users own project creation and follow-up scheduling within their assigned zone.</p>
                </div>
              ) : (
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Zone is not required</span> for this role. This user will operate in a shared global workflow context.
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                      Default Zone
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">{NON_EXECUTIVE_ZONE_LABEL}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-950 via-brand-700 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.8)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.22)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
                  <Users className="h-3.5 w-3.5" />
                  User Registry
                </div>
                <h2 className="mt-2 text-xl font-black text-slate-900">Current users</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadUsers()}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading users...</p>
              ) : registryUsers.length === 0 ? (
                <p className="text-sm text-slate-500">No users found.</p>
              ) : (
                registryUsers.map((user, index) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                    onMouseEnter={(event) => showUserHoverCard(event, user)}
                    onMouseLeave={() => setHoveredActorCard(null)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-10 text-center text-xs font-black text-indigo-600">{index + 1}</span>
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {user.avatarUrl ? (
                          <img src={safeDemoImage(user.avatarUrl)} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          <UserRound className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatRoleLabel(user.role)}{user.role === 'ROLE_EXECUTIVE' && user.zone ? ` - ${formatZoneLabel(user.zone)}` : ''}
                        </p>
                      </div>
                    </div>
                    {user.role !== 'ROLE_SUPER_ADMIN' && user.role !== 'ROLE_ADMIN' && (
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>

      {pendingDeleteUser && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Confirm User Deletion</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-bold text-slate-900">{pendingDeleteUser.email}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={closeDeleteModal} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700">
                Cancel
              </button>
              <button onClick={onDeleteUser} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      <ActorHoverCard hoveredActorCard={hoveredActorCard} />
    </div>
  );
};
