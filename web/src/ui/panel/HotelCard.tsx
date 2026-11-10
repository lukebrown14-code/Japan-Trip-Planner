import { useState } from 'react';
import type { HotelStatus, Stop } from '@shared/types';
import { num, saveEntity } from './util';

export function HotelCard({ stop }: { stop: Stop }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: '', url: '', ja: '', status: 'none' as HotelStatus, cost: '', conf: '', notes: '' });
  const open = () => { setF({ name: stop.hotelName ?? '', url: stop.hotelUrl ?? '', ja: stop.hotelAddressJa ?? '', status: stop.hotelStatus, cost: stop.hotelCost != null ? String(stop.hotelCost) : '', conf: stop.hotelConfirmation ?? '', notes: stop.hotelNotes ?? '' }); setEdit(true); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveEntity('stops', { ...stop, hotelName: f.name.trim() || undefined, hotelUrl: f.url.trim() || undefined, hotelAddressJa: f.ja.trim() || undefined, hotelStatus: f.status === 'none' && f.name.trim() ? 'idea' : f.status, hotelCost: num(f.cost), hotelConfirmation: f.conf.trim() || undefined, hotelNotes: f.notes.trim() || undefined });
    setEdit(false);
  };
  if (edit) return (
    <form className="sp-form" onSubmit={save}>
      <div className="sp-grid">
        <label className="full">Hotel name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label className="full">Link<input type="url" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://" /></label>
        <label className="full">Address (Japanese)<input lang="ja" value={f.ja} onChange={e => setF({ ...f, ja: e.target.value })} placeholder="〒…" /></label>
        <label>Status<select value={f.status} onChange={e => setF({ ...f, status: e.target.value as HotelStatus })}><option value="none">Not chosen</option><option value="idea">Idea</option><option value="booked">Booked</option></select></label>
        <label>Total cost (¥)<input inputMode="numeric" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></label>
        <label className="full">Confirmation no.<input value={f.conf} onChange={e => setF({ ...f, conf: e.target.value })} /></label>
        <label className="full">Notes<textarea className="sp-notes" rows={3} maxLength={1000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Check-in time, how to find it, breakfast…" style={{ fontSize: 16, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} /></label>
      </div>
      <div className="sp-row"><button className="sp-btn pri" type="submit" style={{ flex: 1 }}>Save</button><button type="button" className="sp-btn" onClick={() => setEdit(false)}>Cancel</button></div>
    </form>
  );
  const has = !!stop.hotelName;
  return (
    <div className="sp-card">
      {has ? <>
        <div className="sp-row nw"><b style={{ flex: 1, minWidth: 0 }}>{stop.hotelUrl ? <a href={stop.hotelUrl} target="_blank" rel="noreferrer">{stop.hotelName}</a> : stop.hotelName}</b>
          <span className={`chip ${stop.hotelStatus === 'booked' ? 'booked' : stop.hotelStatus === 'idea' ? 'idea' : 'none'}`}>{stop.hotelStatus === 'booked' ? 'Booked' : stop.hotelStatus === 'idea' ? 'Idea' : 'Not chosen'}</span></div>
        {stop.hotelAddressJa && <span lang="ja">{stop.hotelAddressJa}</span>}
        {stop.hotelNotes && <span style={{ whiteSpace: 'pre-wrap' }}>{stop.hotelNotes}</span>}
        <span className="sp-muted">{[stop.hotelCost != null ? `¥${stop.hotelCost.toLocaleString()}` : '', stop.hotelConfirmation ? `Conf. ${stop.hotelConfirmation}` : ''].filter(Boolean).join(' · ')}</span>
      </> : <span className="sp-muted">Hotel: not chosen yet</span>}
      <div className="sp-row"><button className="sp-btn sm" onClick={open}>{has ? '✎ Edit hotel' : '+ Add hotel'}</button>{has && <a className="sp-btn sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.hotelName} ${stop.name}`)}`} target="_blank" rel="noreferrer">📍 Open in Maps</a>}</div>
    </div>
  );
}
