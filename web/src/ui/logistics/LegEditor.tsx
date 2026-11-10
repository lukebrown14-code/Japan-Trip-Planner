import type { Leg } from '@shared/types';
import { useStore } from '../../store';
import { legRoute } from '../../timeline';
import { BOOK_OPTS, Cell, MODE_LABEL, Pick, commit, fmtMin, num, orUndef } from './common';

/** Per-leg editor: auto route summary from the rail graph + times, cost, status, confirmation, notes. */
export function LegEditor({ leg }: { leg: Leg }) {
  const data = useStore(s => s.data);
  const r = legRoute(data, leg);
  const set = (p: Partial<Leg>) => commit('legs', { ...leg, ...p });
  return (
    <div className="lg-editor">
      {r && (
        <div className="lg-route">
          <b>{r.from.name} → {r.to.name}</b>
          <div className="lg-chips">
            {r.steps.map((s, i) => <span key={i} className={'chip m-' + s.mode}>{MODE_LABEL[s.mode] ?? s.mode} · {s.line} · {fmtMin(s.minutes)}</span>)}
            {r.steps.length > 0 && <span className="chip tot">≈ {fmtMin(r.minutes)} total</span>}
          </div>
        </div>
      )}
      <div className="lg-grid">
        <Cell label="Depart" type="time" value={leg.departTime} onCommit={v => set({ departTime: orUndef(v) })} />
        <Cell label="Arrive" type="time" value={leg.arriveTime} onCommit={v => set({ arriveTime: orUndef(v) })} />
        <Pick label="Status" value={leg.status} options={BOOK_OPTS} onChange={v => set({ status: v })} />
        <Cell label="Cost (¥)" type="number" value={leg.cost} onCommit={v => set({ cost: num(v) })} />
        <Cell label="Confirmation #" value={leg.confirmation} onCommit={v => set({ confirmation: orUndef(v) })} wide />
        <Cell label="Notes" value={leg.notes} placeholder="e.g. reserve oversized-luggage seat" onCommit={v => set({ notes: orUndef(v) })} wide />
      </div>
    </div>
  );
}
