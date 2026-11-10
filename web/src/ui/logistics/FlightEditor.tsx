import type { Flight } from '@shared/types';
import { useStore } from '../../store';
import { shortestPath } from '../../data/rails';
import { stopNode } from '../../timeline';
import { BOOK_OPTS, Cell, Pick, commit, fmtMin, orUndef } from './common';

const BUFFER_MIN = 150, EARLIEST_START = 7 * 60;
const mins = (hhmm: string) => { const m = /(\d{1,2}):(\d{2})/.exec(hhmm); return m ? +m[1] * 60 + +m[2] : 0; };
const hm = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** Out-flight transfer check: last stop -> airport rail minutes + 2.5h buffer vs departAt. */
export function transferCheck(flight: Flight) {
  const d = useStore.getState().data;
  const last = [...d.stops].sort((a, b) => a.ord - b.ord).at(-1);
  if (flight.direction !== 'out' || !last || !flight.departAt) return null;
  const rail = shortestPath(stopNode(last), flight.airport.toLowerCase()).reduce((a, s) => a + s.edge.minutes, 0);
  if (!rail) return null;
  const leaveBy = mins(flight.departAt.slice(11)) - BUFFER_MIN - rail; // minutes into the departure day (can be < 0)
  const slack = leaveBy - EARLIEST_START;
  return { last, rail, leaveBy, slack, level: slack < 0 ? 'red' : slack < 60 ? 'amber' : 'ok' } as const;
}

export function FlightEditor({ flight }: { flight: Flight }) {
  useStore(s => s.data); // re-render on data change (transferCheck reads the store)
  const set = (p: Partial<Flight>) => commit('flights', { ...flight, ...p });
  const t = transferCheck(flight);
  return (
    <div className="lg-card">
      <h3>{flight.direction === 'in' ? '🛬 Inbound flight' : '🛫 Outbound flight'}</h3>
      <div className="lg-grid">
        <Cell label="Airline" value={flight.airline} onCommit={v => set({ airline: orUndef(v) })} />
        <Cell label="Flight number" value={flight.number} onCommit={v => set({ number: orUndef(v) })} />
        <Pick label="Airport" value={flight.airport} options={[['HND', 'Haneda (HND)'], ['NRT', 'Narita (NRT)']]} onChange={v => set({ airport: v })} />
        <Pick label="Status" value={flight.status} options={BOOK_OPTS} onChange={v => set({ status: v })} />
        <Cell label="Departs (local time in Japan)" type="datetime-local" value={flight.departAt} onCommit={v => set({ departAt: orUndef(v) })} wide />
        <Cell label="Arrives (local time in Japan)" type="datetime-local" value={flight.arriveAt} onCommit={v => set({ arriveAt: orUndef(v) })} wide />
        <Cell label="Confirmation #" value={flight.confirmation} onCommit={v => set({ confirmation: orUndef(v) })} wide />
      </div>
      {t && (
        <div className={'lg-warn ' + t.level} role="status">
          <b>{t.level === 'red' ? 'Too tight' : t.level === 'amber' ? 'Tight' : 'Transfer OK'}</b>
          {' '}{t.last.name} → {flight.airport}: rail ≈ {fmtMin(t.rail)} + 2h30 at airport. Leave {t.last.name} by <b>{hm(t.leaveBy)}</b>
          {t.level === 'red' ? ` (before 07:00 — move the flight later or leave the night before)` : t.level === 'amber' ? ` (under 1h slack after a 07:00 start)` : ` (${fmtMin(t.slack)} slack after a 07:00 start)`}.
        </div>
      )}
    </div>
  );
}
