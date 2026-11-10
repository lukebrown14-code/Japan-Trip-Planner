// Compact map header: daily navigation, countdown, bookings, updates and traveller presence.
import { useState } from 'react';
import { useStore } from '../store';
import { bookingsToBook } from './logistics/Drawer';
import { WhatsNewSheet } from './WhatsNew';
import { useUnread } from './collab/unread';
import { personColor, initial } from './collab/people';
import { navClick } from '../nav';
import './collab/collab.css';

export function countdown(start: string, end: string, now = new Date()): string {
  const day = (s: string) => Date.parse(s + 'T00:00:00');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((day(start) - today) / 864e5);
  const total = Math.round((day(end) - day(start)) / 864e5);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return 'Tomorrow!';
  const n = -days + 1;
  if (n <= total + 1 && days <= 0 && today <= day(end)) return `Day ${n} of ${total + 1}`;
  return 'Welcome home';
}

export function TopBar() {
  const trip = useStore(s => s.data.trip), data = useStore(s => s.data), online = useStore(s => s.online), me = useStore(s => s.me);
  const travellers = useStore(s => s.travellers), sel = useStore(s => s.selectedStopId), set = useStore(s => s.set);
  const [open, setOpen] = useState(false);
  const { count, refresh } = useUnread();
  const toBook = bookingsToBook(data);
  const names = online.length ? online : (me ? [{ name: me } as { name: string; stopId?: string }] : []);
  const tripStatus = countdown(trip.startDate, trip.endDate);
  const statusParts = /^(.*) (to go|of \d+|home)$/.exec(tripStatus);
  const presenceLabel = `${online.length ? 'Online' : 'Traveller'}: ${names.map(u => `${u.name}${u.stopId ? `, viewing ${data.stops.find(s => s.id === u.stopId)?.name ?? 'a city'}` : ''}`).join('; ')}`;
  const badge = (n: number) => n > 99 ? '99+' : String(n);
  return (<>
    <header className="topbar" data-cover="top" aria-label="Trip tools">
      <nav className="tb-group tb-navigation" aria-label="Trip navigation">
        <a className="tb-btn tb-today" href="/today" onClick={navClick}>Today <span aria-hidden="true">↗</span></a>
        <a className="tb-btn" href="/transport" onClick={navClick}>Transport</a>
        <span className="tb-count"><span className="tb-sr-only">Trip countdown: </span>{statusParts ? <><span>{statusParts[1]}</span><span className="tb-count-secondary"> {statusParts[2]}</span></> : tripStatus}</span>
      </nav>
      <div className="tb-group tb-actions" role="group" aria-label="Trip actions">
        <button className="tb-btn tb-bookings" aria-label={`Bookings${toBook ? `, ${toBook} still to book` : ', all booked'}`} title="Bookings" onClick={() => set({ menuOpen: true })}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M15 5v3m0 3v2m0 3v3M7 9h4m-4 4h4" /></svg>
          <span className="tb-bookings-label">Bookings</span>
          {toBook > 0 && <span className="tb-badge" aria-hidden="true">{badge(toBook)}</span>}
        </button>
        <button className="tb-btn tb-notifications" aria-label={`What's new${count ? `, ${count} unread updates` : ''}`} title="What's new" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          {count > 0 && <span className="tb-badge" aria-hidden="true">{badge(count)}</span>}
        </button>
        {names.length > 0 && <div className="tb-presence" role="img" aria-label={presenceLabel} title={presenceLabel}>
          {names.slice(0, 3).map(u => <span key={u.name} aria-hidden="true" className={'avatar' + (u.stopId && u.stopId === sel ? ' here' : '')} style={{ background: personColor(u.name, travellers) }}>{initial(u.name)}</span>)}
          {names.length > 1 && <span className="tb-more tb-more-mobile" aria-hidden="true">+{badge(names.length - 1)}</span>}
          {names.length > 3 && <span className="tb-more tb-more-desktop" aria-hidden="true">+{badge(names.length - 3)}</span>}
        </div>}
      </div>
    </header>
    {open && <WhatsNewSheet onClose={() => { setOpen(false); refresh(); }} />}
  </>);
}
