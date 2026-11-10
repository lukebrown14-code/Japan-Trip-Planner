import { useState } from 'react';
import type { Activity, Stop } from '@shared/types';
import { Reactions, CommentsThread, useCommentCount, useReactionSummary } from './Social';
import { ActivityForm } from './ActivityForm';
import { useSnapTo } from '../BottomSheet';
import { catEmoji, deleteEntity, fmtDate, saveEntity } from './util';
import './activity-row.css';

const VEH: Record<string, string> = { shinkansen: '🚄', limited_express: '🚃', train: '🚋', bus: '🚌', plane: '✈️' };
const STATUS: Record<string, string> = { idea: 'Idea', planned: 'Planned', booked: 'Booked' };

export function ActivityRow({ a, stop, days, extra, showDay }: { a: Activity; stop: Stop; days: string[]; extra?: React.ReactNode; showDay?: boolean }) {
  const [edit, setEdit] = useState(false); const [open, setOpen] = useState(false); const [talk, setTalk] = useState(false);
  const n = useCommentCount('activity', a.id); const react = useReactionSummary('activity', a.id);
  const snapTo = useSnapTo();
  if (edit) return <ActivityForm stop={stop} days={days} initial={a} onCancel={() => setEdit(false)} onSave={async d => { await saveEntity('activities', { ...a, ...d } as Activity); setEdit(false); }} />;
  const cycle = () => saveEntity('activities', { ...a, status: a.status === 'idea' ? 'planned' : a.status === 'planned' ? 'booked' : 'idea' });
  const meta = [a.time, showDay ? (a.day ? fmtDate(a.day) : 'Unscheduled') : '', a.kind === 'day_trip' && a.destName ? `to ${a.destName}` : '', a.cost != null ? `¥${a.cost.toLocaleString()}` : '', a.needsBooking && a.status !== 'booked' ? 'needs booking' : ''].filter(Boolean).join(' · ');
  const line = [meta, react, n ? `💬${n}` : ''].filter(Boolean).join(' · ');
  return (
    <div className={`sp-act sp-act-compact${open ? ' is-open' : ''}`}>
      <div className="sp-act-top">
        <button className="sp-act-main" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} details for ${a.title}`} onClick={() => setOpen(!open)}>
          <span className="e">{a.kind === 'day_trip' ? VEH[a.mode ?? 'train'] ?? '🚌' : catEmoji(a.category)}</span>
          <span className="t">{a.title}{line && <small>{line}</small>}</span>
        </button>
        <button className={`chip ${a.status}`} style={{ minHeight: 44, minWidth: 44 }} onClick={cycle} title="Tap to change status" aria-label={`Status: ${STATUS[a.status]}. Tap to change.`}>{STATUS[a.status]}</button>
        <button className="sp-act-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Less' : 'More actions'} <span aria-hidden="true">{open ? '⌃' : '⌄'}</span></button>
      </div>
      {open && <>
        <Reactions targetType="activity" targetId={a.id} />
        <div className="sp-row">
          <button className="sp-btn sm" onClick={() => setTalk(!talk)} aria-expanded={talk} aria-label={`${talk ? 'Hide' : 'Show'} ${n ? `${n} ` : ''}comments`}>💬 {n || ''}</button>
          <a className="sp-btn sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.title} ${stop.name}`)}`} target="_blank" rel="noreferrer" title="Open in Google Maps" aria-label="Open in Google Maps">📍</a>
          {a.url && <a className="sp-btn sm" href={a.url} target="_blank" rel="noreferrer" aria-label="Open link">🔗</a>}
          {extra}
          <span style={{ flex: 1 }} />
          <button className="sp-btn sm" onClick={() => { setEdit(true); snapTo('full'); }} aria-label="Edit">✎</button>
          <button className="sp-btn sm danger" aria-label="Delete" onClick={() => { if (confirm(`Delete "${a.title}"?`)) deleteEntity('activities', a.id); }}>🗑</button>
        </div>
        {talk && <CommentsThread targetType="activity" targetId={a.id} />}
      </>}
    </div>
  );
}
