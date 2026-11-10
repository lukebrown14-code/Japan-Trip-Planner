import { useState } from 'react';
import type { Comment, Reaction } from '@shared/types';
import { useStore } from '../../store';
import { api } from '../../api';

const EMOJI: Reaction['emoji'][] = ['👍', '👎', '🤔'];
type RWithId = Reaction & { id?: string };
const forTarget = <R extends Reaction>(all: R[], t: Reaction['targetType'], id: string) => all.filter(r => r.targetType === t && r.targetId === id);

export function Reactions({ targetType, targetId }: { targetType: Reaction['targetType']; targetId: string }) {
  const me = useStore(s => s.me); const all = useStore(s => s.data.reactions) as RWithId[];
  const mine = forTarget(all, targetType, targetId);
  const toggle = async (emoji: Reaction['emoji']) => {
    if (!me) return;
    const st = useStore.getState();
    const ex = mine.find(r => r.author === me && r.emoji === emoji);
    if (ex?.id) { st.removeEntity('reactions', ex.id); try { await api.remove('reactions', ex.id); } catch { st.upsert('reactions', ex as { id: string }); } return; }
    const tmp = 'tmp-' + Math.random().toString(36).slice(2);
    st.upsert('reactions', { id: tmp, targetType, targetId, author: me, emoji } as never);
    try { const saved = await api.save('reactions', { targetType, targetId, author: me, emoji } as never); st.removeEntity('reactions', tmp); if ((saved as { active?: boolean }).active === false) st.removeEntity("reactions", (saved as { id: string }).id); else st.upsert("reactions", saved as { id: string }); }
    catch { st.removeEntity('reactions', tmp); }
  };
  return (
    <div className="sp-react">
      {EMOJI.map(e => { const who = mine.filter(r => r.emoji === e).map(r => r.author); const on = !!me && who.includes(me);
        return <button key={e} className={on ? 'on' : ''} aria-pressed={on} title={who.join(', ') || 'Nobody yet'} onClick={() => toggle(e)}>
          {e}{who.length > 0 && <> {who.length} <small style={{ fontWeight: 500, opacity: .7 }}>{who.map(w => w[0]).join('')}</small></>}</button>; })}
    </div>
  );
}

/** Compact reaction summary string like "👍2 🤔1" (empty when none). */
export function useReactionSummary(targetType: Reaction['targetType'], targetId: string) {
  return useStore(s => { // one pass, no intermediate arrays: runs for every mounted row on every store write
    const n: Record<string, number> = {};
    for (const r of s.data.reactions) if (r.targetId === targetId && r.targetType === targetType) n[r.emoji] = (n[r.emoji] ?? 0) + 1;
    return EMOJI.filter(e => n[e]).map(e => `${e}${n[e]}`).join(' ');
  });
}

export function useCommentCount(type: Comment['targetType'], id: string) {
  return useStore(s => s.data.comments.filter(c => c.targetType === type && c.targetId === id).length);
}

export function CommentsThread({ targetType, targetId }: { targetType: Comment['targetType']; targetId: string }) {
  const me = useStore(s => s.me); const comments = useStore(s => s.data.comments);
  const [body, setBody] = useState('');
  const list = comments.filter(c => c.targetType === targetType && c.targetId === targetId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const text = body.trim(); if (!text || !me) return;
    setBody('');
    const st = useStore.getState(); const tmp = 'tmp-' + Math.random().toString(36).slice(2);
    const c: Omit<Comment, "id"> & { id?: string } = { targetType, targetId, author: me, body: text, createdAt: new Date().toISOString() };
    st.upsert('comments', { ...c, id: tmp });
    try { const saved = await api.save('comments', c); st.removeEntity('comments', tmp); st.upsert('comments', saved); }
    catch { st.removeEntity('comments', tmp); setBody(text); }
  };
  return (
    <div className="sp-cm">
      {list.length === 0 && <span className="sp-muted">No comments yet.</span>}
      {list.map(c => <div key={c.id} className={'c' + (c.author === me ? ' mine' : '')}><small>{c.author} · {new Date(c.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>{c.body}</div>)}
      <form onSubmit={send}>
        <input value={body} onChange={e => setBody(e.target.value)} placeholder="Write a comment…" aria-label="Comment" enterKeyHint="send" />
        <button className="sp-btn pri" type="submit" disabled={!body.trim()}>Send</button>
      </form>
    </div>
  );
}
