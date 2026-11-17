import React, { useMemo } from 'react';
import { Project } from '../../types';

interface EmbeddedUserDashboardProps {
    projects: Project[];
    userFirstName?: string;
    alertDetails?: string[];
    showGreeting?: boolean;
    alertTone?: 'danger' | 'success';
    greetingAction?: React.ReactNode;
}

export const EmbeddedUserDashboard: React.FC<EmbeddedUserDashboardProps> = ({
    projects,
    userFirstName,
    alertDetails = [],
    showGreeting = false,
    alertTone = 'danger',
    greetingAction
}) => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    const currentDateDisplay = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });

    const alertMessages = useMemo(() => {
        void projects;
        return [...alertDetails];
    }, [alertDetails, projects]);

    const keyedAlertMessages = useMemo(() => {
        const counters = new Map<string, number>();
        return alertMessages.map((message) => {
            const nextCount = (counters.get(message) ?? 0) + 1;
            counters.set(message, nextCount);
            return {
                key: `${message}-${nextCount}`,
                message
            };
        });
    }, [alertMessages]);

    if (!showGreeting && alertMessages.length === 0) {
        return null;
    }

    const alertClassName = alertTone === 'success'
        ? 'rounded-2xl border border-emerald-200 bg-emerald-50/85 text-emerald-700 p-4'
        : 'rounded-2xl border border-rose-200 bg-rose-50/80 text-rose-700 p-4';

    return (
        <section className="mb-8 lg:mb-10 animate-premium">
            <div className="glass-panel rounded-3xl border border-white/60 shadow-premium p-4 md:p-6 lg:p-8 space-y-6">
                {showGreeting && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">{currentDateDisplay}</p>
                            <h2 className="text-2xl lg:text-3xl font-black text-slate-900">{greeting}, {userFirstName || 'User'}</h2>
                        </div>
                        {greetingAction && <div className="shrink-0">{greetingAction}</div>}
                    </div>
                )}

                {alertMessages.length > 0 && (
                    <div className={alertClassName} role="alert" aria-live="polite">
                        <div className="space-y-1">
                            {keyedAlertMessages.map((item) => (
                                <p key={item.key} className="text-sm font-bold">{item.message}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};
