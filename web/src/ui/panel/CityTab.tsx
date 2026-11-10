import { useState } from 'react';
import type { Stop } from '@shared/types';
import { useStore } from '../../store';
import { fmtDate, nightsOf, saveEntity } from './util';

export function CityTab({ stop }: { stop: Stop }) {
  const [notes, setNotes] = useState(stop.notes ?? '');
  const nights = nightsOf(stop.arrive, stop.depart);
  return (<>
    <div className="sp-sec">YOUR STAY</div>
    <div className="sp-card sp-stay">
      <div><b>{nights} night{nights === 1 ? '' : 's'}</b><span className="sp-muted">{fmtDate(stop.arrive)} → {fmtDate(stop.depart)}</span></div>
      <button className="sp-btn sm" onClick={() => useStore.getState().requestNightEditor(stop.id)}>Edit nights</button>
    </div>
    <div className="sp-sec">NOTES</div>
    <textarea className="sp-notes" rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} aria-label="City notes"
      onBlur={() => { if (notes.trim() !== (stop.notes ?? '')) saveEntity('stops', { ...stop, notes: notes.trim() || undefined }); }}
      placeholder="Neighbourhoods, tips, things to remember…" style={{ width: '100%', resize: 'vertical' }} />
  </>);
}
