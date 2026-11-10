import { useState, type ReactNode } from 'react';
import type { Activity, Flight, Stop } from '@shared/types';
import { useStore } from '../../store';
import { BOOK_OPTS, Cell, Pick, commit, num, orUndef } from './common';
import { transportTasks } from '../../transport/progress';
import { navClick } from '../../nav';
import { transportHref } from '../../transport/routes';
import { MQ_MOBILE } from '../layout';

interface Item { key: string; icon: string; title: string; sub: string; done: boolean; na?: boolean; stopId: string | null; ord: number; editor: ReactNode }
const short = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function HotelEditor({ s }: { s: Stop }) {
  const set = (p: Partial<Stop>) => commit('stops', { ...s, ...p });
  return (
    <div className="lg-grid">
      <Cell label="Hotel name" value={s.hotelName} onCommit={v => set({ hotelName: orUndef(v) })} wide />
      <Pick label="Status" value={s.hotelStatus} options={[['none', 'Not chosen'], ['idea', 'Idea'], ['booked', 'Booked']]} onChange={v => set({ hotelStatus: v })} />
      <Cell label="Cost (¥)" type="number" value={s.hotelCost} onCommit={v => set({ hotelCost: num(v) })} />
      <Cell label="Confirmation #" value={s.hotelConfirmation} onCommit={v => set({ hotelConfirmation: orUndef(v) })} wide />
    </div>
  );
}
function ActivityEditor({ a }: { a: Activity }) {
  const set = (p: Partial<Activity>) => commit('activities', { ...a, ...p });
  return (
    <div className="lg-grid">
      <Pick label="Status" value={a.status} options={[['idea', 'Idea'], ['planned', 'Planned'], ['booked', 'Booked']]} onChange={v => set({ status: v })} />
      <Cell label="Cost (¥)" type="number" value={a.cost} onCommit={v => set({ cost: num(v) })} />
      <Cell label="Confirmation #" value={a.confirmation} onCommit={v => set({ confirmation: orUndef(v) })} wide />
    </div>
  );
}
function FlightRowEditor({ f }: { f: Flight }) {
  const set = (p: Partial<Flight>) => commit('flights', { ...f, ...p });
  return (
    <div className="lg-grid">
      <Pick label="Status" value={f.status} options={BOOK_OPTS} onChange={v => set({ status: v })} />
      <Cell label="Confirmation #" value={f.confirmation} onCommit={v => set({ confirmation: orUndef(v) })} />
    </div>
  );
}

function openCity(id: string) {
  const st = useStore.getState();
  st.focusStop(id);
  if (window.matchMedia(MQ_MOBILE).matches) st.set({ menuOpen: false });
}

export function BookingsBoard() {
  const d = useStore(s => s.data); const selected = useStore(s => s.selectedStopId);
  const [open, setOpen] = useState<string | null>(null);
  const stops = [...d.stops].sort((a, b) => a.ord - b.ord); const byId = new Map(stops.map(s => [s.id, s]));
  const name = (id: string) => byId.get(id)?.name ?? '?';
  const items: Item[] = [];
  stops.forEach(s => items.push({ key: 'h' + s.id, icon: '🏨', title: s.hotelName || `Hotel in ${s.name}`, sub: `${s.name} · ${short(s.arrive)}–${short(s.depart)}`,
    done: s.hotelStatus === 'booked', stopId: s.id, ord: s.ord * 10, editor: <HotelEditor s={s} /> }));
  transportTasks(d).forEach(t => items.push({ key: t.key, icon: t.kind === 'pass' ? '🎫' : '🚄', title: t.title,
    sub: [t.date ? short(t.date) : '', t.nextAction].filter(Boolean).join(' · '), done: t.ready, stopId: null,
    ord: t.journey?.sourceType === 'leg' ? (byId.get(d.legs.find(l => l.id === t.journey?.sourceId)?.fromStop ?? '')?.ord ?? 0) * 10 + 5
      : t.date ? (stops.find(s => s.arrive <= t.date! && s.depart >= t.date!)?.ord ?? 0) * 10 + 6 : 0,
    editor: <><p>{t.nextAction}</p><a className="lg-open" href={transportHref(t.journey?.key)} onClick={navClick}>Open journey in Transport →</a></> }));
  d.flights.forEach(f => items.push({ key: 'f' + f.id, icon: f.direction === 'in' ? '🛬' : '🛫', title: `${f.direction === 'in' ? 'Flight in' : 'Flight home'} ${f.number ?? ''} (${f.airport})`.replace('  ', ' '),
    sub: f.departAt?.replace('T', ' ') ?? 'times TBC', done: f.status !== 'to_book', na: f.status === 'na', stopId: (f.direction === 'in' ? stops[0] : stops.at(-1))?.id ?? null,
    ord: f.direction === 'in' ? -1 : 1e6, editor: <FlightRowEditor f={f} /> }));
  d.activities.filter(a => a.needsBooking).forEach(a => items.push({ key: 'a' + a.id, icon: '🎟️', title: a.title, sub: `${name(a.stopId)}${a.day ? ' · ' + short(a.day) : ''}`,
    done: a.status === 'booked', stopId: a.stopId, ord: (byId.get(a.stopId)?.ord ?? 0) * 10 + 7, editor: <ActivityEditor a={a} /> }));
  items.sort((a, b) => a.ord - b.ord);
  const group = (title: string, list: Item[], tone: string) => (
    <section className={'lg-group ' + tone}>
      <h3>{title} <span>{list.length}</span></h3>
      {list.length === 0 && <p className="lg-empty">{tone === 'todo' ? 'Nothing left to book 🎉' : 'Nothing booked yet'}</p>}
      {list.map(i => (
        <div key={i.key} className={'lg-row' + (i.stopId && i.stopId === selected ? ' sel' : '')}>
          <div className="head">
            <button className="main" aria-expanded={open === i.key} onClick={() => { if (i.stopId) useStore.getState().selectStop(i.stopId); setOpen(open === i.key ? null : i.key); }}>
              <span className="ic">{i.icon}</span><span className="tx"><b>{i.title}</b><small>{i.sub}</small></span>
              {i.na && <em className="pill na">n/a</em>}
            </button>
            <button className="chev" aria-expanded={open === i.key} aria-label="Edit" onClick={() => setOpen(open === i.key ? null : i.key)}>{open === i.key ? '▴' : '▾'}</button>
          </div>
          {open === i.key && <div className="body">{i.editor}{i.stopId && <button className="lg-open" onClick={() => openCity(i.stopId!)}>Open {name(i.stopId)} →</button>}</div>}
        </div>))}
    </section>
  );
  return <><a className="lg-open" href={transportHref()} onClick={navClick}>Between-city transport →</a>{group('To book', items.filter(i => !i.done), 'todo')}{group('Booked', items.filter(i => i.done), 'done')}</>;
}
