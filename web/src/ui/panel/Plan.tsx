import { useState } from 'react';
import type { Activity, Stop } from '@shared/types';
import { useStore } from '../../store';
import { ActivityRow } from './ActivityRow';
import { ActivityForm } from './ActivityForm';
import { IncomingLeg } from './IncomingLeg';
import { useSnapTo } from '../BottomSheet';
import { daysBetween, fmtDate, nightsOf, saveEntity } from './util';

const byTime = (a: Activity, b: Activity) => (a.time ?? '99').localeCompare(b.time ?? '99');

export function Plan({ stop }: { stop: Stop }) {
  const data = useStore(s => s.data); const me = useStore(s => s.me);
  const [adding, setAdding] = useState<string | null>(null); // the day whose add form is open, or null
  const snapTo = useSnapTo();
  const toggle = (day: string) => { if (adding === day) setAdding(null); else { setAdding(day); snapTo('full'); } };
  const days = daysBetween(stop.arrive, stop.depart);
  const acts = data.activities.filter(a => a.stopId === stop.id);
  const nights = nightsOf(stop.arrive, stop.depart);
  const form = (day: string) => <ActivityForm key={adding} stop={stop} days={days} onCancel={() => setAdding(null)} initial={{ day, status: 'planned' }}
    onSave={async d => { await saveEntity('activities', { ...d, createdBy: me ?? undefined } as Activity); setAdding(null); }} />;
  return (<>
    <div className="sp-sum">
      <span>{fmtDate(stop.arrive)} → {fmtDate(stop.depart)} · {nights} night{nights === 1 ? '' : 's'}</span>
      <span>{stop.hotelName ? `🏨 ${stop.hotelName}` : '🏨 No hotel yet'}</span>
    </div>
    <IncomingLeg stop={stop} />
    <div className="sp-sec">SCHEDULE</div>
    {days.map(d => { const list = acts.filter(a => a.day === d).sort(byTime); return (
      <div key={d}><div className="sp-day"><span>{fmtDate(d)}{d === stop.arrive ? ' · arrive' : d === stop.depart ? ' · depart' : ''}</span>
        <button className="add" aria-label={`Add activity on ${fmtDate(d)}`} onClick={() => toggle(d)}>{adding === d ? '×' : '+'}</button></div>
        {adding === d && form(d)}
        <div className="sp-list">{list.length ? list.map(a => <ActivityRow key={a.id} a={a} stop={stop} days={days} />) : <span className="sp-muted" style={{ fontSize: 12 }}>Nothing planned</span>}</div></div>); })}
  </>);
}
