// OWNED BY: Collaboration agent. Feed of changes since last visit (GET /api/whatsnew), opened from TopBar bell.
import { useEffect, useState } from 'react';
import type { ChangeEvent } from '@shared/api';
import { BottomSheet } from './BottomSheet';
import { fetchWhatsNew, markSeen } from '../api.real';
import { resetWhatsNew } from './collab/unread';
import { personColor, initial } from './collab/people';
import { useStore } from '../store';
import './collab/collab.css';

const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

export function WhatsNewSheet({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<ChangeEvent[] | null>(null); const travellers = useStore(s => s.travellers);
  useEffect(() => { fetchWhatsNew().then(r => setEvents(r.events)).catch(() => setEvents([])); }, []);
  const close = () => { markSeen().finally(resetWhatsNew); resetWhatsNew(); onClose(); };
  return (
    <div className="wn-wrap"><BottomSheet initial="half" header={<div className="wn-head"><span>What's new</span><button onClick={close}>Done</button></div>}>
      {events === null ? <p>Loading...</p> : events.length === 0 ? <p>You're all caught up.</p> :
        events.map(e => <div key={e.id} className="wn-item"><span className="avatar" style={{ background: personColor(e.author, travellers) }}>{initial(e.author)}</span>
          <div>{e.summary}<small>{e.author} - {ago(e.at)}</small></div></div>)}
    </BottomSheet></div>
  );
}
// Standalone mount kept for App.tsx compatibility: the sheet is opened from TopBar, so this renders nothing.
export function WhatsNew() { return null; }
