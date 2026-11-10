import { useState } from 'react';
import type { Activity } from '@shared/types';
import { CommentsThread, useCommentCount } from './Social';
import { catEmoji } from './util';

/** Compact expandable per-activity comment thread (Chat tab). */
export function ActivityThread({ a }: { a: Activity }) {
  const [open, setOpen] = useState(false); const n = useCommentCount('activity', a.id);
  return (
    <div className="sp-act">
      <button className="sp-btn" style={{ minHeight: 44, textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center', boxShadow: 'none', border: 0, background: 'none', padding: 0 }} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 20 }}>{catEmoji(a.category)}</span><span style={{ flex: 1 }}>{a.title}</span><span className="sp-muted">💬 {n}</span>
      </button>
      {open && <CommentsThread targetType="activity" targetId={a.id} />}
    </div>
  );
}
