import type { Collection } from '@shared/api';
import { api } from '../../api';
import { useStore } from '../../store';

export const dayMs = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z');
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d: string) => { const t = new Date(dayMs(d)); return `${WD[t.getUTCDay()]} ${t.getUTCDate()} ${MO[t.getUTCMonth()]}`; };
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string): string[] => {
  const out: string[] = []; const e = dayMs(b);
  for (let t = dayMs(a); t <= e && out.length < 60; t += 864e5) out.push(isoDay(t));
  return out;
};
export { nightsOf } from '../../planner';

export const CATEGORIES: Record<string, string> = { sight: '⛩️', food: '🍜', shop: '🛍️', nature: '🌳', museum: '🏛️', nightlife: '🍶', onsen: '♨️', transport: '🚉', other: '📍' };
export const catEmoji = (c?: string) => (c && CATEGORIES[c]) || '📍';

/** Persist via api then mirror into the store. Returns saved entity. */
export async function saveEntity<T extends { id?: string }>(c: Collection, e: T): Promise<T & { id: string }> {
  const saved = await api.save(c, e);
  useStore.getState().upsert(c, saved);
  return saved;
}
/** Mirror the server's delete cascade into the store (the server also broadcasts a delete event per row). */
export function removeCascade(c: Collection, id: string) {
  const st = useStore.getState(); const d = st.data;
  const attached = (t: string, i: string) => {
    for (const x of d.comments.filter(x => x.targetType === t && x.targetId === i)) st.removeEntity('comments', x.id);
    for (const x of d.reactions.filter(x => x.targetType === t && x.targetId === i)) st.removeEntity('reactions', (x as { id?: string }).id ?? `${x.targetType}:${x.targetId}:${x.author}:${x.emoji}`);
  };
  if (c === 'stops') {
    for (const a of d.activities.filter(a => a.stopId === id)) { attached('activity', a.id); st.removeEntity('activities', a.id); }
    for (const l of d.legs.filter(l => l.fromStop === id || l.toStop === id)) { attached('leg', l.id); st.removeEntity('legs', l.id); }
    attached('stop', id);
  } else if (c === 'activities') attached('activity', id);
  else if (c === 'legs') attached('leg', id);
  st.removeEntity(c, id);
}
export async function deleteEntity(c: Collection, id: string) {
  await api.remove(c, id);
  removeCascade(c, id);
}
export const num = (v: string): number | undefined => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };
