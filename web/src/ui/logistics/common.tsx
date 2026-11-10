import { useEffect, useState } from 'react';
import type { Collection } from '@shared/api';
import { api } from '../../api';
import { useStore } from '../../store';

/** Optimistic write: upsert into the store at once, persist, roll back on failure. */
export async function commit<T extends { id: string }>(c: Collection, e: T, opts?: { createOnly?: boolean }) {
  const st = useStore.getState();
  const list = (st.data as any)[c] as T[];
  const prev = list.find(x => x.id === e.id);
  st.upsert(c, e);
  try {
    const saved = await api.save(c, e, opts);
    if (saved.id !== e.id) { useStore.getState().removeEntity(c, e.id); useStore.getState().upsert(c, saved); }
    else if (opts?.createOnly) useStore.getState().upsert(c, saved); // adopt the server's row if it already existed
  } catch (err) {
    console.error('save failed', c, err);
    if (prev) useStore.getState().upsert(c, prev); else useStore.getState().removeEntity(c, e.id);
  }
}
export async function destroy(c: Collection, id: string) {
  const list = (useStore.getState().data as any)[c] as { id: string }[];
  const prev = list.find(x => x.id === id);
  useStore.getState().removeEntity(c, id);
  try { await api.remove(c, id); } catch (err) { console.error(err); if (prev) useStore.getState().upsert(c, prev); }
}

/** Text/number/time input that keeps a local draft and commits on blur or Enter. */
export function Cell({ label, value, onCommit, type = 'text', placeholder, wide }: {
  label: string; value: string | number | undefined; onCommit: (v: string) => void; type?: string; placeholder?: string; wide?: boolean;
}) {
  const v = value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(v);
  useEffect(() => setDraft(v), [v]);
  const done = () => { if (draft !== v) onCommit(draft); };
  return (
    <label className={'lg-f' + (wide ? ' wide' : '')}>
      <span>{label}</span>
      <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} value={draft} placeholder={placeholder}
        onChange={e => setDraft(e.target.value)} onBlur={done}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}
export function Pick<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <label className="lg-f">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as V)}>{options.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
    </label>
  );
}
export const num = (s: string) => { const n = parseFloat(s.replace(/[^0-9.]/g, '')); return s.trim() === '' || isNaN(n) ? undefined : n; };
export const orUndef = (s: string) => s.trim() === '' ? undefined : s;
export const BOOK_OPTS: ['to_book' | 'booked' | 'na', string][] = [['to_book', 'To book'], ['booked', 'Booked'], ['na', 'Not needed']];
export const MODE_LABEL: Record<string, string> = { shinkansen: 'Shinkansen', limited_express: 'Ltd express', train: 'Train', bus: 'Bus', walk: 'Walk', plane: 'Flight' };
export const fmtMin = (m: number) => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r}m`; };
