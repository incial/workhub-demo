import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Mail, MapPin, Shield } from 'lucide-react';
import { AuditLogRow } from '../../types';
import { safeDemoImage } from '../../demo/network';

const ACTOR_CARD_Z_INDEX = 1200;

export interface HoveredActorCardState {
  actor?: AuditLogRow['actor'];
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

interface ActorHoverCardProps {
  hoveredActorCard: HoveredActorCardState | null;
}

const formatRole = (role?: string) => role ? role.replace(/^ROLE_/, '').replace(/_/g, ' ') : 'N/A';
const formatZone = (zone?: string) => zone ? zone.replace(/_/g, ' ') : 'N/A';
const formatCreatedAt = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

export const ActorHoverCard: React.FC<ActorHoverCardProps> = ({ hoveredActorCard }) => {
  if (!hoveredActorCard) return null;
  const shouldShowZone = hoveredActorCard.actor?.role === 'ROLE_EXECUTIVE' && Boolean(hoveredActorCard.actor?.zone);

  return createPortal(
    <div
      className="pointer-events-none fixed w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-100"
      style={{
        top: hoveredActorCard.top,
        left: hoveredActorCard.left,
        zIndex: ACTOR_CARD_Z_INDEX,
        transform: hoveredActorCard.placement === 'top' ? 'translateY(-100%)' : undefined
      }}
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600 uppercase">
          {hoveredActorCard.actor?.avatarUrl ? (
            <img src={safeDemoImage(hoveredActorCard.actor?.avatarUrl)} alt={`${hoveredActorCard.actor?.name || 'User'} avatar`} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span>{(hoveredActorCard.actor?.name || 'U').charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{hoveredActorCard.actor?.name || 'Unknown User'}</p>
          <p className="text-xs text-slate-500 truncate">{hoveredActorCard.actor?.email || 'No email'}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-700 rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-100">
          <Shield size={14} className="text-slate-500" />
          <span className="font-medium">{formatRole(hoveredActorCard.actor?.role)}</span>
        </div>
        {shouldShowZone && (
          <div className="flex items-center gap-2 text-xs text-slate-700 rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-100">
            <MapPin size={14} className="text-slate-500" />
            <span className="font-medium">{formatZone(hoveredActorCard.actor?.zone)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-700 rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-100">
          <Mail size={14} className="text-slate-500" />
          <span className="font-medium truncate">{hoveredActorCard.actor?.email || 'No email'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-700 rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-100">
          <CalendarClock size={14} className="text-slate-500" />
          <span className="font-medium">{formatCreatedAt(hoveredActorCard.actor?.createdAt)}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
