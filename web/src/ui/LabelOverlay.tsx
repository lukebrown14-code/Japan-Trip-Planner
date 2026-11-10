import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { labelPos } from '../scene/city/LabelLayer';
import { dateRange } from '../scene/city/util';
import { CITIES } from '../data/cities';
import { isOnRoute } from '../scene/city/candidate';
import { AddToTripCard, useCandidate, focusCityFromMap } from './AddToTripCard';

/** Label ids: stop ids, plus 'cand:<key>' for cities not on the route. */
const candKeys = (stops: { cityKey: string }[]) => Object.values(CITIES).filter(c => !isOnRoute(c.key, stops)).map(c => c.key);

const INK = '#1b2a4a', GREY = '#8a8a8a';
type Box = { l: number; r: number; t: number; b: number };
/** City signs as plain DOM over the canvas. De-overlap slides signs sideways first (then up in small steps),
 *  drawing a short slanted leader to the real anchor so a sign always stays attached to its city. */
export function LabelOverlay() {
  const data = useStore(s => s.data), candSel = useCandidate(s => s.key), sel = useStore(s => s.selectedStopId);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const lines = useRef<Record<string, SVGGElement | null>>({});
  useEffect(() => {
    let raf = 0;
    const cur: Record<string, { dx: number; dy: number; k: number }> = {}; // smoothed offsets
    const prev: Record<string, number> = {};                               // last candidate index (hysteresis)
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const W = innerWidth, small = W < 640, k = small ? 0.74 : 1, STEM = small ? 7 : 9;
      const stops = useStore.getState().data.stops, ck = useCandidate.getState().key, selId = useStore.getState().selectedStopId ?? (ck && 'cand:' + ck);
      const items = [...stops.map(s => s.id), ...candKeys(stops).map(k => 'cand:' + k)].map(id => ({ id, ...(labelPos[id] ?? { x: -999, y: -999, vis: false }) }))
        .sort((a, b) => (a.id === selId ? -1 : b.id === selId ? 1 : b.y - a.y));
      const placed: Box[] = [];
      for (const it of items) {
        const el = refs.current[it.id], g = lines.current[it.id]; if (!el || !g) continue;
        if (!it.vis) { el.style.display = 'none'; g.style.display = 'none'; continue; }
        const w = (el.offsetWidth || 140) * k, h = (el.offsetHeight || 46) * k;
        // candidates: horizontal slides first, then stacked slightly higher
        const cands: [number, number][] = [];
        for (const rise of [0, 0.5, 1.05, 1.6]) for (const sx of [0, -0.58, 0.58, -1.12, 1.12]) cands.push([sx * w, -rise * h]);
        const free = (c: [number, number]) => {
          const cx = Math.min(Math.max(it.x + c[0], w / 2 + 6), W - w / 2 - 6), b = it.y + c[1] - STEM, t = b - h;
          if (items.some(o => o !== it && o.vis && o.x > cx - w / 2 - 6 && o.x < cx + w / 2 + 6 && o.y > t - 6 && o.y < b + 14)) return false; // never cover another city's anchor
          return !placed.some(p => cx - w / 2 < p.r + 3 && cx + w / 2 > p.l - 3 && t < p.b + 3 && b > p.t - 3);
        };
        let ci = prev[it.id] ?? 0; if (!free(cands[ci])) { ci = cands.findIndex(free); if (ci < 0) ci = 0; }
        prev[it.id] = ci;
        const c = cands[ci], st = cur[it.id] ?? (cur[it.id] = { dx: c[0], dy: c[1], k });
        st.dx += (c[0] - st.dx) * 0.3; st.dy += (c[1] - st.dy) * 0.3; st.k = k;
        const cx = Math.min(Math.max(it.x + st.dx, w / 2 + 6), W - w / 2 - 6), bot = it.y + st.dy - STEM;
        placed.push({ l: cx - w / 2, r: cx + w / 2, t: bot - h, b: bot });
        el.style.display = 'block';
        el.style.transform = `translate(${cx.toFixed(1)}px, ${bot.toFixed(1)}px) translate(-50%, -100%) scale(${k})`;
        // leader: from the sign bottom (clamped near the anchor x) down to the anchor
        const lx = Math.min(Math.max(it.x, cx - w / 2 + 12), cx + w / 2 - 12);
        g.style.display = 'block';
        const ln = g.firstElementChild as SVGLineElement, dot = g.lastElementChild as SVGCircleElement;
        ln.setAttribute('x1', lx.toFixed(1)); ln.setAttribute('y1', bot.toFixed(1)); ln.setAttribute('x2', it.x.toFixed(1)); ln.setAttribute('y2', it.y.toFixed(1));
        dot.setAttribute('cx', it.x.toFixed(1)); dot.setAttribute('cy', it.y.toFixed(1));
      }
    };
    tick(); return () => cancelAnimationFrame(raf);
  }, []);
  const cands = candKeys(data.stops);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {data.stops.map(s => (
          <g key={s.id} ref={el => { lines.current[s.id] = el; }} style={{ display: 'none' }}>
            <line stroke={INK} strokeWidth={2} strokeLinecap="round" />
            <circle r={3.2} fill="#ffd666" stroke={INK} strokeWidth={1.6} />
          </g>
        ))}
        {cands.map(k => (
          <g key={k} ref={el => { lines.current['cand:' + k] = el; }} style={{ display: 'none', opacity: 0.5 }}>
            <line stroke={GREY} strokeWidth={1.2} strokeLinecap="round" strokeDasharray="3 3" />
            <circle r={2} fill="#d4d4d4" stroke={GREY} strokeWidth={1} />
          </g>
        ))}
      </svg>
      {cands.map(k => { const c = CITIES[k], on = candSel === k; return (
        <div key={k} ref={el => { refs.current['cand:' + k] = el; }} onClick={() => { useStore.getState().set({ selectedStopId: null }); useCandidate.getState().set(k); }}
          style={{ position: 'absolute', left: 0, top: 0, display: 'none', transformOrigin: '50% 100%', pointerEvents: 'auto', cursor: 'pointer', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', zIndex: on ? 2 : 0, opacity: on ? 0.9 : 0.6, fontStyle: 'italic', whiteSpace: 'nowrap', fontSize: 11, lineHeight: 1.1, color: '#6b6b6b', padding: '1px 6px', borderRadius: 5, background: 'rgba(235,235,235,.7)', fontFamily: "var(--font-ui),'Hiragino Sans','Noto Sans JP',sans-serif" }}>
          {c.nameJa} {c.name}
        </div>); })}
      <AddToTripCard />
      {data.stops.map(s => {
        const on = sel === s.id;
        return (
          <div key={s.id} ref={el => { refs.current[s.id] = el; }} onClick={() => focusCityFromMap(s.id)}
            style={{ position: 'absolute', left: 0, top: 0, display: 'none', transformOrigin: '50% 100%', pointerEvents: 'auto', cursor: 'pointer', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', zIndex: on ? 2 : 1, fontFamily: "var(--font-ui),'Hiragino Sans','Noto Sans JP',sans-serif" }}>
            <div style={{ display: 'inline-block', padding: '3px 12px 4px', borderRadius: 8, whiteSpace: 'nowrap', color: INK, lineHeight: 1.15, border: `2px solid ${INK}`,
              background: on ? 'linear-gradient(#ffe9a8,#f6c768)' : 'linear-gradient(#f9ecd0,#e8cd9a)', boxShadow: on ? '0 0 0 3px rgba(255,214,102,.65), 0 3px 0 #1b2a4a' : '0 3px 0 #1b2a4a' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.nameJa} <span style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</span></div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#8a2c1c' }}>{dateRange(s.arrive, s.depart)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
