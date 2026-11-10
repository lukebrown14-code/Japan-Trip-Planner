// OWNED BY: Logistics agent. Drawer (open when store.menuOpen) with tabs: Bookings, Flights, Checklist; also exports bookingsToBook(data).
import { useEffect, useState } from 'react';
import type { Flight, Leg, TripData } from '@shared/types';
import { useStore } from '../../store';
import { BookingsBoard } from './BookingsBoard';
import { FlightEditor } from './FlightEditor';
import { Checklist } from './Checklist';
import { commit } from './common';
import { transportTasks } from '../../transport/progress';
import './logistics.css';

export { WeatherStrip } from './Weather';
export { LegEditor } from './LegEditor';
export { FlightEditor } from './FlightEditor';
export { BookingsBoard } from './BookingsBoard';
export { Checklist } from './Checklist';

export function bookingsToBook(d: TripData): number {
  return d.stops.filter(s => s.hotelStatus !== 'booked').length
    + transportTasks(d).filter(t => !t.ready).length
    + d.flights.filter(f => f.status === 'to_book').length
    + d.activities.filter(a => a.needsBooking && a.status !== 'booked').length;
}

const pending = new Set<string>();
/** Create a leg for every consecutive stop pair that lacks one. Ids match the timeline's fallback id. */
export function ensureLegs() {
  const d = useStore.getState().data; const stops = [...d.stops].sort((a, b) => a.ord - b.ord);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1]; const key = a.id + '>' + b.id;
    if (pending.has(key) || d.legs.some(l => l.fromStop === a.id && l.toStop === b.id)) continue;
    pending.add(key);
    const leg: Leg = { id: `leg-${a.id}-${b.id}`, fromStop: a.id, toStop: b.id, status: 'to_book' };
    commit('legs', leg, { createOnly: true }).finally(() => pending.delete(key));
  }
}

const TABS = [['bookings', 'Bookings'], ['flights', 'Flights'], ['checklist', 'Checklist']] as const;
type Tab = typeof TABS[number][0];

export function LogisticsDrawer() {
  const open = useStore(s => s.menuOpen); const data = useStore(s => s.data);
  const [tab, setTab] = useState<Tab>('bookings');
  const close = () => useStore.getState().set({ menuOpen: false });
  useEffect(() => { if (open) ensureLegs(); }, [open, data.stops, data.legs]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  if (!open) return null;
  const todo = bookingsToBook(data);
  const flight = (dir: 'in' | 'out') => data.flights.find(f => f.direction === dir);
  const addFlight = (direction: 'in' | 'out') => { const f: Flight = { id: Math.random().toString(36).slice(2, 10), direction, airport: 'HND', status: 'to_book' }; commit('flights', f); };
  return (
    <>
      <div className="lg-backdrop" onClick={close} />
      <aside className="lg-drawer" role="dialog" aria-label="Trip logistics" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
        <header>
          <div className="lg-title"><h2>Trip logistics</h2><small>{todo ? `${todo} still to book` : 'All booked'}</small></div>
          <button className="lg-close" aria-label="Close" onClick={close}>✕</button>
        </header>
        <nav role="tablist">
          {TABS.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}
        </nav>
        <div className="lg-body">
          {tab === 'bookings' && <BookingsBoard />}
          {tab === 'flights' && (['in', 'out'] as const).map(dir => { const f = flight(dir);
            return f ? <FlightEditor key={f.id} flight={f} /> : <button key={dir} className="lg-link" onClick={() => addFlight(dir)}>+ Add {dir === 'in' ? 'inbound' : 'outbound'} flight</button>; })}
          {tab === 'checklist' && <Checklist />}
        </div>
      </aside>
    </>
  );
}
