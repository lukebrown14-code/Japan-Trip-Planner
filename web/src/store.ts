import { create } from 'zustand';
import type { TripData } from '@shared/types';
import type { Collection } from '@shared/api';
import { SEED } from './data/seed';
export type Quality = 'high' | 'low';
const OPEN_KEY = 'japan-planner-open';
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; } };
// planner.css switches --tl-h (the height panels reserve) on this attribute; set before first paint and on every toggle
const applyOpen = (open: boolean, expanded = false) => { if (typeof document !== 'undefined') document.documentElement.dataset.planner = open ? (expanded ? 'expanded' : 'open') : 'closed'; };
interface S {
  data: TripData;                 // swapped for live data in Phase 2
  selectedStopId: string | null; fitNonce: number; focusReq: { n: number; keepZoom: boolean }; selectNonce: number; // fitNonce: frame the trip; focusReq: fly to selectedStopId (a new object per request; keepZoom = pan only, never zoom); selectNonce: bumps on every (re)selection, even of the same stop
  quality: Quality; plannerOpen: boolean; plannerExpanded: boolean; plannerPanelActive: boolean; plannerPanelOverride: boolean | null; // expanded = calendar view (full-screen on phones, taller bar on desktop)
  me: string | null; travellers: string[]; online: { name: string; stopId?: string }[]; menuOpen: boolean;
  nightEditorRequest: { stopId: string; nonce: number } | null;
  upsert: (c: Collection, e: { id: string }) => void; upsertMany: (c: Collection, es: { id: string }[]) => void; removeEntity: (c: Collection, id: string) => void;
  replaceEntity: (c: Collection, e: { id: string }) => void;
  set: (p: Partial<S>) => void;
  fit: () => void; selectStop: (id: string) => void; focusStop: (id: string, opts?: { keepZoom?: boolean }) => void; togglePlanner: () => void; toggleExpanded: () => void; setPlannerPanelActive: (active: boolean) => void;
  requestNightEditor: (stopId: string) => void;
}
// Automatic mobile collapse is temporary; only explicit toggles change the saved preference.
export const plannerIsOpen = (s: Pick<S, 'plannerOpen' | 'plannerExpanded' | 'plannerPanelActive' | 'plannerPanelOverride'>) =>
  s.plannerExpanded || (s.plannerPanelActive ? s.plannerPanelOverride ?? false : s.plannerOpen);
export const useStore = create<S>((set, get) => ({
  data: SEED, selectedStopId: null, fitNonce: 0, focusReq: { n: 0, keepZoom: false }, selectNonce: 0, quality: 'high', plannerOpen: readOpen(), plannerExpanded: false, plannerPanelActive: false, plannerPanelOverride: null, me: null, travellers: [], online: [], menuOpen: false, nightEditorRequest: null,
  upsert: (c, e) => get().upsertMany(c, [e]),
  // Server change events contain complete rows, including the absence of cleared optional fields.
  replaceEntity: (c, e) => set(s => {
    const list = (((s.data as any)[c] ?? []) as { id: string }[]);
    return { data: { ...s.data, [c]: list.some(x => x.id === e.id) ? list.map(x => x.id === e.id ? e : x) : [...list, e] } };
  }),
  // one `set` for the whole batch, so subscribers (scene, labels) render once, never with a half-applied pair
  upsertMany: (c, es) => set(s => {
    const next = [...(((s.data as any)[c] ?? []) as { id: string }[])];
    for (const e of es) { const i = next.findIndex(x => x.id === e.id); if (i < 0) next.push(e); else next[i] = { ...next[i], ...e }; }
    return { data: { ...s.data, [c]: next } as TripData };
  }),
  removeEntity: (c, id) => set(s => ({ data: { ...s.data, [c]: (((s.data as any)[c] ?? []) as { id: string }[]).filter(x => x.id !== id) } as TripData })),
  set: (p) => set(p), fit: () => set(s => ({ fitNonce: s.fitNonce + 1 })),
  selectStop: (id) => set(s => ({ selectedStopId: id, selectNonce: s.selectNonce + 1 })),
  focusStop: (id, opts) => { get().selectStop(id); set(s => ({ focusReq: { n: s.focusReq.n + 1, keepZoom: !!opts?.keepZoom } })); },
  requestNightEditor: (stopId) => set(s => ({ nightEditorRequest: { stopId, nonce: (s.nightEditorRequest?.nonce ?? 0) + 1 } })),
  togglePlanner: () => set(s => {
    const plannerOpen = !plannerIsOpen(s);
    try { localStorage.setItem(OPEN_KEY, plannerOpen ? '1' : '0'); } catch { /* ignore */ }
    return { plannerOpen, plannerExpanded: false, plannerPanelOverride: s.plannerPanelActive ? plannerOpen : null };
  }),
  toggleExpanded: () => set(s => ({ plannerExpanded: !s.plannerExpanded })),
  setPlannerPanelActive: (active) => set(s => s.plannerPanelActive === active ? s : { plannerPanelActive: active, plannerPanelOverride: null }),
}));
applyOpen(plannerIsOpen(useStore.getState()), useStore.getState().plannerExpanded);
useStore.subscribe((s, previous) => {
  if (plannerIsOpen(s) !== plannerIsOpen(previous) || s.plannerExpanded !== previous.plannerExpanded)
    applyOpen(plannerIsOpen(s), s.plannerExpanded);
});
if (typeof window !== 'undefined') (window as any).__store = useStore;
