import { useState } from 'react';
import type { Activity, Mode, Stop } from '@shared/types';
import { CITIES } from '../../data/cities';
import { CATEGORIES, fmtDate, num } from './util';

export type ActivityDraft = Partial<Activity>;

export function ActivityForm({ stop, days, initial, onSave, onCancel }: { stop: Stop; days: string[]; initial?: ActivityDraft; onSave: (a: ActivityDraft) => void | Promise<void>; onCancel: () => void }) {
  const [a, setA] = useState<ActivityDraft>({ kind: 'activity', status: 'idea', category: 'sight', ...initial });
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : '');
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(() => !!initial?.id && (initial.kind === 'day_trip' || initial.cost != null || !!initial.url || !!initial.needsBooking || !!initial.confirmation || (!!initial.status && initial.status !== 'idea')));
  const set = (p: ActivityDraft) => setA(x => ({ ...x, ...p }));
  const trips = CITIES[stop.cityKey]?.dayTrips ?? [];
  const isTrip = a.kind === 'day_trip';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = (a.title ?? '').trim() || (isTrip && a.destName ? `${a.destName} day trip` : ''); if (!title) return;
    setBusy(true);
    await onSave({ ...a, title, cost: num(cost), url: a.url?.trim() || undefined, time: a.time || undefined, day: a.day || undefined, stopId: stop.id });
    setBusy(false);
  };
  return (
    <form className="sp-form" onSubmit={submit}>
      <div className="sp-grid">
        <label className="full">Title<input value={a.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="e.g. Senso-ji at dawn" autoFocus={!initial?.id} /></label>
        <label>Category<select value={a.category ?? 'other'} onChange={e => set({ category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}</select></label>
        <label>Day<select value={a.day ?? ''} onChange={e => set({ day: e.target.value || undefined })}>{a.category === 'food' && <option value="">Unscheduled</option>}{days.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}</select></label>
        <label>Time<input type="time" value={a.time ?? ''} onChange={e => set({ time: e.target.value })} /></label>
      </div>
      <button type="button" className="sp-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Fewer details' : 'More details'}</button>
      {more && <div className="sp-grid">
        <label>Type<select value={a.kind} onChange={e => set({ kind: e.target.value as Activity['kind'], mode: e.target.value === 'day_trip' ? (a.mode ?? 'train') : undefined })}><option value="activity">Activity</option><option value="day_trip">Day trip</option></select></label>
        {isTrip && <>
          {trips.length > 0 && <div className="full sp-chips">{trips.map(t => <button type="button" key={t.name} onClick={() => set({ destName: t.name, destLat: t.lat, destLng: t.lng, mode: t.mode, title: a.title || `${t.name} day trip` })}>{t.name}</button>)}</div>}
          <label>Destination<input value={a.destName ?? ''} onChange={e => set({ destName: e.target.value })} placeholder="Destination name" /></label>
          <label>Travel by<select value={a.mode ?? 'train'} onChange={e => set({ mode: e.target.value as Mode })}><option value="train">Train</option><option value="bus">Bus</option><option value="limited_express">Limited express</option><option value="shinkansen">Shinkansen</option></select></label>
          <label>Dest. lat<input inputMode="decimal" value={a.destLat ?? ''} onChange={e => set({ destLat: num(e.target.value) })} /></label>
          <label>Dest. lng<input inputMode="decimal" value={a.destLng ?? ''} onChange={e => set({ destLng: num(e.target.value) })} /></label>
        </>}
        <label>Status<select value={a.status} onChange={e => set({ status: e.target.value as Activity['status'] })}><option value="idea">Idea</option><option value="planned">Planned</option><option value="booked">Booked</option></select></label>
        <label>Cost (¥)<input inputMode="numeric" value={cost} onChange={e => setCost(e.target.value)} placeholder="optional" /></label>
        <label className="full">Link<input type="url" value={a.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder="https://" /></label>
        <label className="full sp-chk" style={{ flexDirection: 'row' }}><input type="checkbox" checked={!!a.needsBooking} onChange={e => set({ needsBooking: e.target.checked })} /> Needs booking / tickets</label>
        {a.status === 'booked' && <label className="full">Confirmation no.<input value={a.confirmation ?? ''} onChange={e => set({ confirmation: e.target.value })} /></label>}
      </div>}
      <div className="sp-row"><button className="sp-btn pri" disabled={busy} type="submit" style={{ flex: 1 }}>{initial?.id ? 'Save' : 'Add'}</button><button type="button" className="sp-btn" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
