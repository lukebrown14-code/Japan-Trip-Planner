import { useState } from 'react';
import type { Leg, Stop } from '@shared/types';
import { CITIES } from '../../data/cities';
import { useStore } from '../../store';
import { api } from '../../api';
import { ensureLegs } from '../logistics/Drawer';
import { commit } from '../logistics/common';
import { cityColor, nightsOf } from '../../planner';
import { deleteEntity, fmtDate, isoDay, dayMs, num, saveEntity } from './util';

/** Add / reorder / remove stops. Lives in the expanded trip planner. */
export function StopEditor() {
  const data = useStore(s => s.data); const set = useStore(s => s.set);
  const [adding, setAdding] = useState(false);
  const stops = [...data.stops].sort((a, b) => a.ord - b.ord);
  const last = stops[stops.length - 1];
  const [f, setF] = useState({ preset: '', name: '', ja: '', lat: '', lng: '', arrive: '', depart: '' });
  const start = () => { const a = last?.depart ?? data.trip.startDate; setF({ preset: '', name: '', ja: '', lat: '', lng: '', arrive: a, depart: isoDay(dayMs(a) + 864e5) }); setAdding(true); };
  const pick = (k: string) => { const c = CITIES[k]; setF(c ? { ...f, preset: k, name: c.name, ja: c.nameJa, lat: String(c.lat), lng: String(c.lng) } : { ...f, preset: '' }); };
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); const lat = num(f.lat), lng = num(f.lng); if (!f.name.trim() || lat == null || lng == null || !f.arrive || !f.depart) return;
    const saved = await saveEntity('stops', { ord: (last?.ord ?? -1) + 1, cityKey: f.preset || 'custom', name: f.name.trim(), nameJa: f.ja.trim(), lat, lng, arrive: f.arrive, depart: f.depart < f.arrive ? f.arrive : f.depart, hotelStatus: 'none' } as Stop);
    if (last) await commit('legs', { id: `leg-${last.id}-${saved.id}`, fromStop: last.id, toStop: saved.id, status: 'to_book' } as Leg, { createOnly: true });
    setAdding(false); useStore.getState().selectStop(saved.id);
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!stops[i] || !stops[i + d]) return;
    const ids = stops.map(s => s.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    try { for (const s of await api.reorderStops(ids)) useStore.getState().upsert('stops', s); ensureLegs(); } catch (err) { console.error('reorder failed', err); }
  };
  const remove = async (s: Stop) => {
    if (!confirm(`Remove ${s.name} and its activities?`)) return;
    try { await deleteEntity('stops', s.id); } catch (err) { console.error('delete failed', err); return; } // server cascades activities/legs/comments/reactions
    ensureLegs(); // bridge prev->next
    if (useStore.getState().selectedStopId === s.id) set({ selectedStopId: null });
  };
  return (<>
    <div className="sp-sec"><span>STOPS</span></div>
    <>
      <div className="sp-stops">{stops.map((s, i) => (
        <div className="r tp-srow" key={s.id}><span className="swatch" style={{ background: cityColor(i) }} />
          <b className="tp-sname"><span>{s.name} <small className="sp-muted">{s.nameJa}</small></span><small className="sp-muted">{fmtDate(s.arrive)} → {fmtDate(s.depart)} · {nightsOf(s.arrive, s.depart)}n</small></b>
          <button className="sp-ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button className="sp-ghost" aria-label="Move down" disabled={i === stops.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button className="sp-ghost" aria-label={`Remove ${s.name}`} onClick={() => remove(s)}>🗑</button></div>))}</div>
      {adding ? (
        <form className="sp-form" onSubmit={add}>
          <div className="sp-grid">
            <label className="full">City preset<select value={f.preset} onChange={e => pick(e.target.value)}><option value="">Custom…</option>{Object.values(CITIES).map(c => <option key={c.key} value={c.key}>{c.name} {c.nameJa}</option>)}</select></label>
            <label>Name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
            <label>Japanese<input lang="ja" value={f.ja} onChange={e => setF({ ...f, ja: e.target.value })} /></label>
            <label>Latitude<input inputMode="decimal" value={f.lat} onChange={e => setF({ ...f, lat: e.target.value })} /></label>
            <label>Longitude<input inputMode="decimal" value={f.lng} onChange={e => setF({ ...f, lng: e.target.value })} /></label>
            <label>Arrive<input type="date" value={f.arrive} onChange={e => setF({ ...f, arrive: e.target.value })} /></label>
            <label>Depart<input type="date" value={f.depart} onChange={e => setF({ ...f, depart: e.target.value })} /></label>
          </div>
          <div className="sp-row"><button className="sp-btn pri" type="submit" style={{ flex: 1 }}>Add stop</button><button type="button" className="sp-btn" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      ) : <button className="sp-btn sm" style={{ marginTop: 8 }} onClick={start}>+ Add stop</button>}
    </>
  </>);
}
