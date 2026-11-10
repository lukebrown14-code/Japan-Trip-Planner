import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { Leg, Stop } from '@shared/types';
import { CITIES } from '../data/cities';
import { useStore } from '../store';
import { labelPos } from '../scene/city/LabelLayer';
import { saveEntity, isoDay, dayMs } from './panel/util';
import { commit } from './logistics/common';

/** Selected candidate city key (candidates are not stops, so this lives outside the trip store). */
export const useCandidate = create<{ key: string | null; set: (k: string | null) => void }>(s => ({ key: null, set: k => s({ key: k }) }));

/** A tap on a trip city (map model or its sign): drop any candidate card, select it and pan only if it is covered. */
export const focusCityFromMap = (id: string) => { useCandidate.getState().set(null); useStore.getState().focusStop(id, { keepZoom: true }); };

/** Append a candidate city as a stop after the last one (1 night), plus the leg from the previous stop. Same path as StopEditor. */
let adding = false;
export async function addCandidateStop(key: string) {
  const c = CITIES[key]; if (!c || adding) return;
  adding = true; try {
  const d = useStore.getState().data, last = [...d.stops].sort((a, b) => a.ord - b.ord).pop(), a = last?.depart ?? d.trip.startDate;
  const saved = await saveEntity('stops', { ord: (last?.ord ?? -1) + 1, cityKey: key, name: c.name, nameJa: c.nameJa, lat: c.lat, lng: c.lng, arrive: a, depart: isoDay(dayMs(a) + 864e5), hotelStatus: 'none' } as Stop);
  if (last) await commit('legs', { id: `leg-${last.id}-${saved.id}`, fromStop: last.id, toStop: saved.id, status: 'to_book' } as Leg, { createOnly: true });
  useCandidate.getState().set(null); useStore.getState().selectStop(saved.id);
  } finally { adding = false; }
}

/** Small card anchored above the selected candidate city's label. */
export function AddToTripCard() {
  const key = useCandidate(s => s.key), el = useRef<HTMLDivElement>(null);
  const inTrip = useStore(s => !!key && s.data.stops.some(x => x.cityKey === key));
  useEffect(() => { if (inTrip) useCandidate.getState().set(null); }, [inTrip]);
  useEffect(() => {
    if (!key) return; let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); const p = labelPos['cand:' + key], n = el.current; if (!n || !p) return; n.style.transform = `translate(${p.x}px, ${p.y - 70}px) translate(-50%, -100%)`; n.style.display = p.vis ? 'block' : 'none'; };
    tick(); return () => cancelAnimationFrame(raf);
  }, [key]);
  const c = key ? CITIES[key] : null; if (!c) return null;
  return (
    <div ref={el} style={{ position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'auto', padding: '8px 10px', borderRadius: 10, border: '2px solid #1b2a4a', background: '#fff6e0', boxShadow: '0 3px 0 #1b2a4a', color: '#1b2a4a', textAlign: 'center', fontFamily: "var(--font-ui),'Hiragino Sans','Noto Sans JP',sans-serif", whiteSpace: 'nowrap' }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nameJa} {c.name}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'center' }}>
        <button onClick={() => addCandidateStop(c.key)} style={{ padding: '4px 10px', borderRadius: 7, border: '2px solid #1b2a4a', background: '#ffd666', font: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Add to trip</button>
        <button onClick={() => useCandidate.getState().set(null)} aria-label="Close" style={{ padding: '4px 8px', borderRadius: 7, border: '2px solid #1b2a4a', background: 'transparent', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>✕</button>
      </div>
    </div>
  );
}
