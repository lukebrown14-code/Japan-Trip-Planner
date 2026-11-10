// In-memory ApiClient (persisted to localStorage) so UI can be built and tested without the server.
import type { ApiClient, Collection } from '@shared/api';
import type { Stop, TripData } from '@shared/types';
import { importTravelBookings, TRAVEL_IMPORT_VERSION } from '@shared/travelImport';
import { SEED } from './data/seed';
const KEY = 'japan-mock-trip';
// Match the server's omission of cleared optional fields, including inside full-replacement service lists.
function cleanOptionalFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanOptionalFields) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, field]) => field !== null && field !== undefined)
    .map(([key, field]) => [key, cleanOptionalFields(field)])) as T;
  return value;
}
type CachedTrip = TripData & { _dataImports?: string[] };
let db: CachedTrip = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '') as TripData; } catch { return structuredClone(SEED); } })();
db = cleanOptionalFields(db);
db.transportPlans ??= [];
db.transportBookings ??= [];
if (!db._dataImports?.includes(TRAVEL_IMPORT_VERSION)) {
  const imported = importTravelBookings(db, SEED);
  if (imported) {
    db = { ...imported, _dataImports: [...(db._dataImports ?? []), TRAVEL_IMPORT_VERSION] };
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* Retry on next load if storage is unavailable. */ }
  }
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } };
let me: string | null = localStorage.getItem('japan-mock-me') ?? 'Luke';
// mimic the server's delete cascade (stop -> activities, legs; comments/reactions of anything removed)
function cascade(c: Collection, id: string) {
  const dropAttached = (t: string, i: string) => { db.comments = db.comments.filter(x => !(x.targetType === t && x.targetId === i)); db.reactions = db.reactions.filter(x => !(x.targetType === t && x.targetId === i)); };
  if (c === 'stops') {
    for (const a of db.activities.filter(a => a.stopId === id)) dropAttached('activity', a.id);
    for (const l of db.legs.filter(l => l.fromStop === id || l.toStop === id)) dropAttached('leg', l.id);
    db.activities = db.activities.filter(a => a.stopId !== id); db.legs = db.legs.filter(l => l.fromStop !== id && l.toStop !== id); dropAttached('stop', id);
  } else if (c === 'activities') dropAttached('activity', id);
  else if (c === 'legs') dropAttached('leg', id);
}
const uid = () => Math.random().toString(36).slice(2, 10);
export const mockApi: ApiClient = {
  async login(_p, name) { me = name; localStorage.setItem('japan-mock-me', name); },
  async me() { return me ? { name: me, travellers: ['Luke', 'Partner'] } : null; },
  async trip() { const { _dataImports, ...trip } = db; return structuredClone(trip); },
  async save(c: Collection, e: any, opts?: { createOnly?: boolean }) { const existing = ((db as any)[c] as any[]).find(x => x.id === e.id); const defaults = existing ? {} : c === 'transportPlans' ? { adults: 2, eligibilityConfirmed: false } : c === 'transportBookings' ? { purchased: false, seatReserved: false, payOnDay: false } : {}; const ent = { ...defaults, ...e, id: e.id ?? uid() }; const list = (db as any)[c] as any[]; const i = list.findIndex(x => x.id === ent.id);
    if (opts?.createOnly) { const ex = list.find(x => x.id === ent.id || (c === 'legs' && x.fromStop === ent.fromStop && x.toStop === ent.toStop)); if (ex) return structuredClone(ex); } if (i < 0) list.push(cleanOptionalFields(ent)); else list[i] = cleanOptionalFields({ ...list[i], ...ent }); persist(); return structuredClone(list[i < 0 ? list.length - 1 : i]); },
  async remove(c, id) { cascade(c, id); (db as any)[c] = ((db as any)[c] as any[]).filter(x => x.id !== id); persist(); },
  async reorderStops(ids) {
    const have = new Set(db.stops.map(s => s.id));
    if (new Set(ids).size !== ids.length || ids.length !== have.size || !ids.every(i => have.has(i))) throw new Error('409 reorder mismatch');
    const changed: Stop[] = [];
    ids.forEach((id, n) => { const s = db.stops.find(x => x.id === id)!; if (s.ord !== n) { s.ord = n; changed.push(structuredClone(s)); } });
    persist(); return changed;
  },
  async weather() { return null; },
};
