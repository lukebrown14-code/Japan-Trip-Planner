import { useState } from 'react';
import type { Activity, Stop } from '@shared/types';
import { useStore } from '../../store';
import { ActivityRow } from './ActivityRow';
import { daysBetween, fmtDate, saveEntity } from './util';

export function EatTab({ stop }: { stop: Stop }) {
  const acts = useStore(s => s.data.activities); const reactions = useStore(s => s.data.reactions); const me = useStore(s => s.me);
  const [title, setTitle] = useState(''); const [book, setBook] = useState(false);
  const days = daysBetween(stop.arrive, stop.depart);
  const votes = (id: string) => reactions.filter(r => r.targetType === 'activity' && r.targetId === id && r.emoji === '👍').length;
  const food = acts.filter(a => a.stopId === stop.id && a.category === 'food').sort((a, b) => votes(b.id) - votes(a.id));
  const toBook = food.filter(a => a.needsBooking && a.status !== 'booked');
  const schedule = (a: Activity, day: string) => { if (day) saveEntity('activities', { ...a, day, status: a.status === 'idea' ? 'planned' : a.status }); };
  const add = (e: React.FormEvent) => { e.preventDefault(); const t = title.trim(); if (!t) return; setTitle(''); setBook(false); saveEntity('activities', { stopId: stop.id, kind: 'activity', title: t, category: 'food', status: 'idea', needsBooking: book || undefined, createdBy: me ?? undefined } as Activity); };
  const row = (a: Activity) => (
    <ActivityRow key={a.id} a={a} stop={stop} days={days} showDay extra={
      <select aria-label="Schedule on day" value="" style={{ width: 'auto', fontWeight: 700 }} onChange={e => schedule(a, e.target.value)}>
        <option value="">{a.day ? fmtDate(a.day) : 'Schedule…'}</option>{days.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}</select>} />);
  return (<>
    <form className="sp-row nw" onSubmit={add}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`Add a place to eat in ${stop.name}…`} aria-label="New food spot" enterKeyHint="done" />
      <button className="sp-btn pri" type="submit" disabled={!title.trim()}>Add</button>
    </form>
    <label className="sp-chk sp-muted" style={{ display: 'flex', gap: 6, margin: '6px 0' }}><input type="checkbox" checked={book} onChange={e => setBook(e.target.checked)} /> Needs a reservation</label>
    {toBook.length > 0 && <>
      <div className="sp-sec">BOOK AHEAD</div>
      <div className="sp-chips">{toBook.map(a => <span key={a.id} className="chip idea">{a.title}</span>)}</div>
    </>}
    <div className="sp-sec">{stop.name.toUpperCase()} EATS</div>
    <div className="sp-list">{food.length ? food.map(row) : <span className="sp-muted">Nothing yet. Add a ramen counter, a market, a must-try izakaya…</span>}</div>
  </>);
}
