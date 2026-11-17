import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useOperatorView } from '../context/OperatorViewContext';
import { useZone } from '../context/ZoneContext';
import { useToast } from '../context/ToastContext';
import { projectApi } from '../services/api';
import { ExecutiveProjectStatus, Project } from '../types';

type CalendarEvent = {
    id: number;
    projectId: number;
    title: string;
    dateStr: string;
    project: Project;
};

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const CALENDAR_STATUSES: ExecutiveProjectStatus[] = ['NON_ONBOARDED'];

const isNonOnboardedProject = (project: Project) => {
    if (project.executiveViewStatus) {
        return project.executiveViewStatus === 'NON_ONBOARDED';
    }
    return !['ONBOARDED', 'SALES', 'ACCOUNTS', 'INSTALLATION', 'COMPLETED', 'DROPPED'].includes(project.currentStage);
};

const getProjectTitle = (project: Project) => {
    const projectName = project.projectName?.trim();
    const schoolName = project.school?.trim();
    return projectName || schoolName || 'Unnamed Project';
};

const getSchoolSubtitle = (project: Project) => {
    const projectName = project.projectName?.trim();
    const schoolName = project.school?.trim();
    if (!schoolName || schoolName === projectName) {
        return '';
    }
    return schoolName;
};

const getExecutiveLabel = (project: Project) => project.createdBy?.trim() || 'Unknown Executive';

export const UniversalCalendarPage: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { effectiveZone } = useZone();
    const { effectiveRole } = useOperatorView();
    const { isSidebarCollapsed, showSidebar } = useLayout();

    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                setLoading(true);
                const data = await projectApi.getExecutiveProjects(effectiveZone, CALENDAR_STATUSES);
                setProjects(data);
            } catch (error: any) {
                showToast(error.message || 'Failed to load calendar projects', 'error');
                setProjects([]);
            } finally {
                setLoading(false);
            }
        };
        loadProjects();
    }, [effectiveZone, showToast]);

    const todayStr = useMemo(() => new Intl.DateTimeFormat('en-CA').format(new Date()), []);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const calendarEvents = useMemo(() => {
        return projects
            .filter(project => isNonOnboardedProject(project) && !!project.nextContact)
            .map(project => {
                const nextContactDate = new Date(project.nextContact!);
                if (Number.isNaN(nextContactDate.getTime())) return null;
                return {
                    id: project.id,
                    projectId: project.id,
                    title: getProjectTitle(project),
                    dateStr: toDateStr(nextContactDate),
                    project
                } as CalendarEvent;
            })
            .filter(Boolean) as CalendarEvent[];
    }, [projects]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const event of calendarEvents) {
            const existing = map.get(event.dateStr) || [];
            existing.push(event);
            map.set(event.dateStr, existing);
        }
        return map;
    }, [calendarEvents]);

    const selectedDateStr = selectedDate ? toDateStr(selectedDate) : '';
    const selectedDateEvents = selectedDateStr ? (eventsByDate.get(selectedDateStr) || []) : [];
    const totalUpcomingEvents = calendarEvents.length;
    const todayEventsCount = eventsByDate.get(todayStr)?.length || 0;
    const monthEventsCount = calendarEvents.filter((event) => {
        const eventDate = new Date(`${event.dateStr}T00:00:00`);
        return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    }).length;

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const renderCells = () => {
        const cells: React.ReactNode[] = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayIdx = new Date(year, month, 1).getDay();

        for (let i = 0; i < firstDayIdx; i++) {
            cells.push(<div key={`empty-prev-${i}`} className="bg-slate-50/20 border-b border-r border-slate-100 min-h-[100px] md:min-h-[108px]" />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = toDateStr(date);
            const isToday = todayStr === dateStr;
            const dayEvents = eventsByDate.get(dateStr) || [];

            cells.push(
                <button
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`group relative border-b border-r border-slate-100 min-h-[100px] md:min-h-[108px] p-2 md:p-2.5 text-left transition-all hover:bg-white/80 hover:shadow-sm active:scale-[0.995] ${isToday ? 'bg-indigo-50/30' : 'bg-white/40'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className={`relative flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all ${
                            isToday
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
                                : 'text-slate-400 group-hover:bg-white group-hover:text-slate-900 group-hover:scale-105'
                        }`}>
                            {day}
                            {isToday && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-300 animate-pulse" />}
                        </span>
                    </div>

                    <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map(event => (
                            <div
                                key={event.id}
                                className="w-full p-1 rounded-lg md:rounded-xl border text-[8px] md:text-[9px] font-black uppercase tracking-tight shadow-sm transition-all hover:scale-[1.02] flex items-center gap-1 bg-white/60 backdrop-blur-sm text-slate-600 border-slate-200"
                            >
                                <div className="w-1 h-1 rounded-full shrink-0 bg-indigo-500" />
                                <span className="truncate min-w-0">{event.title}</span>
                            </div>
                        ))}

                        {dayEvents.length > 3 && (
                            <div className="text-center py-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    +{dayEvents.length - 3} More Events
                                </span>
                            </div>
                        )}
                    </div>
                </button>
            );
        }

        const totalVisible = firstDayIdx + daysInMonth;
        const nextPadding = (7 - (totalVisible % 7)) % 7;
        for (let i = 0; i < nextPadding; i++) {
            cells.push(<div key={`empty-next-${i}`} className="bg-slate-50/20 border-b border-r border-slate-100 min-h-[100px] md:min-h-[108px]" />);
        }

        return cells;
    };

    if (loading) {
        return (
            <div className="flex min-h-screen mesh-bg relative">
                <div className="glass-canvas" />
                <Sidebar />
                <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                    <Navbar />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Syncing Timeline...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />

                <main className="flex-1 px-4 lg:px-10 py-5 lg:py-8 pb-24 overflow-y-auto custom-scrollbar">
                    <div className="mb-5 md:mb-6 rounded-[2rem] border border-white/70 bg-white/55 p-4 shadow-[0_20px_55px_-35px_rgba(15,23,42,0.35)] backdrop-blur-3xl md:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-indigo-700">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    Calendar View
                                </div>
                                <h1 className="mt-3 text-3xl font-black tracking-tighter text-slate-900 md:text-4xl lg:text-5xl">
                                    Executive Follow-up Calendar
                                </h1>
                                <p className="mt-2 text-sm font-medium text-slate-500">
                                    A premium scheduling view for next-contact follow-ups across active executive leads.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {monthEventsCount} this month
                                    </span>
                                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                        {todayEventsCount} today
                                    </span>
                                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                        {totalUpcomingEvents} scheduled
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/projects')}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
                                aria-label="Close calendar"
                                title="Close calendar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-center mb-4 md:mb-5">
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 md:gap-2 bg-white/40 backdrop-blur-2xl p-1.5 md:p-2 rounded-2xl border border-white shadow-inner">
                            <button onClick={handlePrevMonth} className="p-2 md:p-2.5 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-xl transition-all shadow-sm active:scale-90">
                                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                            <button onClick={() => setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="px-3 md:px-6 py-2 text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.16em] md:tracking-[0.2em] hover:text-indigo-600 transition-colors">
                                {viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                            </button>
                            <button onClick={handleNextMonth} className="p-2 md:p-2.5 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-xl transition-all shadow-sm active:scale-90">
                                <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white/40 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-premium overflow-x-auto scroll-smooth custom-scrollbar pb-1">
                        <div className="min-w-[760px] md:min-w-[820px]">
                            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="py-3 md:py-3.5 text-center text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider md:tracking-[0.3em]">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 auto-rows-fr border-l border-slate-100">
                                {renderCells()}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {selectedDate && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setSelectedDate(null)}>
                    <div
                        className="bg-white/90 backdrop-blur-3xl rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col border border-white/60"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-gray-100 bg-white/40 flex items-start justify-between shrink-0 backdrop-blur-xl">
                            <div className="flex items-center gap-6">
                                <div className="h-20 w-20 bg-slate-950 rounded-[1.8rem] flex flex-col items-center justify-center text-white shadow-xl ring-4 ring-white/50">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{selectedDate.toLocaleDateString('en-GB', { month: 'short' })}</span>
                                    <span className="text-4xl font-black tracking-tighter leading-none">{selectedDate.getDate()}</span>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                                        {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black border border-indigo-100 uppercase tracking-widest">
                                            {selectedDateEvents.length} Events
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">Scheduled for this cycle</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-white rounded-full transition-all active:scale-95">
                                <Plus className="h-6 w-6 rotate-45" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-10 bg-gradient-to-b from-white/20 to-white/60">
                            <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-white/80 backdrop-blur-xl py-3 px-2 rounded-2xl border border-white/50 shadow-sm">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <CalendarDays className="h-4 w-4 text-indigo-500" /> Follow-ups
                                </h3>
                            </div>

                            <div className="space-y-4 pt-2">
                                {selectedDateEvents.length > 0 ? selectedDateEvents.map(event => (
                                    <div key={event.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase tracking-widest inline-block mb-2">
                                                    Next Contact
                                                </p>
                                                <h4 className="text-base font-black text-slate-900 truncate">{event.title}</h4>
                                                {getSchoolSubtitle(event.project) && (
                                                    <p className="text-xs text-slate-500 mt-1">{getSchoolSubtitle(event.project)}</p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                                    <span className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        Executive
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-700">
                                                        {getExecutiveLabel(event.project)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => navigate(`/projects?projectId=${event.projectId}&mode=view`)}
                                                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 transition-all"
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/projects?projectId=${event.projectId}&mode=edit`)}
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-700 border border-indigo-200 transition-all"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-[2rem] border border-slate-200 border-dashed">
                                        <div className="h-16 w-16 bg-white rounded-[1.5rem] flex items-center justify-center shadow-sm mb-4 border border-slate-100">
                                            <CalendarDays className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900">No synchronized events</p>
                                        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wide">Timeline is clear for this cycle</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
