import { useEffect, useState } from 'react';
import { fetchWhatsNew } from '../../api.real';
import { useStore } from '../../store';
// Unread count = events since last_seen (server) + live changes by others this session.
let live = 0; const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
export function bumpWhatsNew() { live++; emit(); }
export function resetWhatsNew() { live = 0; emit(); }
export function useUnread(): { count: number; refresh: () => void } {
  const me = useStore(s => s.me);
  const [base, setBase] = useState(0); const [, tick] = useState(0);
  const refresh = () => { fetchWhatsNew().then(r => setBase(r.events.filter(e => e.author !== me).length)).catch(() => {}); };
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  useEffect(() => { if (me) refresh(); /* eslint-disable-next-line */ }, [me]);
  return { count: base + live, refresh };
}
