// Expanded trip planner: month calendar (days tinted by stop), day detail, and stop management.
import { useEffect, useMemo, useState } from 'react';
import type { Stop, Trip } from '@shared/types';
import { useStore } from '../store';
import { CITY_COLORS, monthGrid, nightsOf, stopsForDay } from '../planner';
import { fmtDate } from './panel/util';
import { StopEditor } from './panel/StopEditor';
import './panel/panel.css';
import './planner-calendar.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const byTime = (a: { time?: string }, b: { time?: string }) => (a.time ?? '99').localeCompare(b.time ?? '99');

// The Calendar unmounts when closed; remember its selection for this browser session.
let lastSelection: { tripId: string; day: string } | null = null;
function todayInJapan(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function initialDay(trip: Trip): string {
  if (lastSelection?.tripId === trip.id && lastSelection.day >= trip.startDate && lastSelection.day <= trip.endDate) return lastSelection.day;
  const today = todayInJapan();
  return today >= trip.startDate && today <= trip.endDate ? today : trip.startDate;
}

export function PlannerCalendar() {
  const data = useStore(s => s.data); const focusStop = useStore(s => s.focusStop); const toggleExpanded = useStore(s => s.toggleExpanded);
  const { trip } = data;
  const stops = useMemo(() => [...data.stops].sort((a, b) => a.ord - b.ord), [data.stops]);
  const months = useMemo(() => monthGrid(trip), [trip]);
  const [day, setDay] = useState(() => initialDay(trip));
  const [view, setView] = useState<'calendar' | 'stops'>('calendar');
  const today = todayInJapan();
  const todayIsInTrip = today >= trip.startDate && today <= trip.endDate;
  const selectedDay = day >= trip.startDate && day <= trip.endDate ? day : trip.startDate;
  useEffect(() => { lastSelection = { tripId: trip.id, day: selectedDay }; }, [trip.id, selectedDay]);
  const chooseDay = (iso: string) => setDay(iso);
  const colour = (s: Stop) => CITY_COLORS[stops.indexOf(s) % CITY_COLORS.length];
  const bg = (iso: string) => {
    const on = stopsForDay(stops, iso); if (!on.length) return undefined;
    if (on.length === 1) return colour(on[0]);
    const [a, b] = [colour(on[0]), colour(on[on.length - 1])]; return `linear-gradient(135deg, ${a} 50%, ${b} 50%)`; // changeover day
  };
  const acts = (iso: string) => data.activities.filter(a => a.day === iso);
  const inTrip = (iso: string) => iso >= trip.startDate && iso <= trip.endDate;
  const dayStops = stopsForDay(stops, selectedDay);
  const dayActs = acts(selectedDay).sort(byTime);
  const open = (s: Stop) => { focusStop(s.id); toggleExpanded(); };

  return (
    <div className="tp-exp sp tp-calendar-view" data-view={view}>
      <div className="tp-calendar-nav">
        <div className="tp-calendar-tabs" role="group" aria-label="Planner view">
          <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
          <button aria-pressed={view === 'stops'} onClick={() => setView('stops')}>Stops</button>
        </div>
        <div className="tp-calendar-actions">
          {view === 'calendar' && todayIsInTrip && <button className="tp-calendar-action" onClick={() => chooseDay(today)}>Jump to today</button>}
          <button className="tp-calendar-action tp-manage-stops" onClick={() => setView(view === 'stops' ? 'calendar' : 'stops')} aria-pressed={view === 'stops'}>{view === 'stops' ? 'Back to calendar' : 'Manage stops'}</button>
        </div>
      </div>
      {view === 'calendar' ? <div role="region" aria-label="Trip calendar" className="tp-cal">
        <div className="tp-months">
          {months.map(m => (
            <section key={m.key} className="tp-month" aria-label={m.label}>
              <h3>{m.label}</h3>
              <div className="tp-wd" aria-hidden>{WEEKDAYS.map((d, i) => <span key={i} className={i === 6 ? 'hol' : ''}>{d}</span>)}</div>
              {m.weeks.filter(w => w.some(iso => iso && inTrip(iso))).map((w, wi) => (
                <div className="tp-wk" key={wi}>
                  {w.map((iso, di) => {
                    if (!iso) return <span key={di} className="tp-cell pad" />;
                    const n = acts(iso).length, on = inTrip(iso);
                    return (
                    <button key={iso} className={`tp-cell${on ? '' : ' off'}${di === 6 ? ' hol' : ''}${selectedDay === iso ? ' sel' : ''}`} disabled={!on}
                        style={{ background: bg(iso) }} aria-pressed={selectedDay === iso} onClick={() => chooseDay(iso)}
                        aria-label={`${fmtDate(iso)}${stopsForDay(stops, iso).map(s => `, ${s.name}`).join('')}${n ? `, ${n} activit${n === 1 ? 'y' : 'ies'}` : ''}`}>
                        <b>{Number(iso.slice(8))}</b>
                        {n > 0 && <i className="dots" aria-hidden>{'•'.repeat(Math.min(n, 3))}</i>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="tp-detail" aria-live="polite">
          <h3>{fmtDate(selectedDay)}</h3>
            {dayStops.length === 0 && <p className="sp-muted">No stop on this day.</p>}
            {dayStops.map(s => (
              <button className="tp-dstop" key={s.id} onClick={() => open(s)} aria-label={`Open ${s.name}`}>
                <span className="swatch" style={{ background: colour(s) }} />
                <b>{s.name}</b>
                <small>{selectedDay === s.arrive ? 'arrive' : selectedDay === s.depart ? 'depart' : 'staying'} · {nightsOf(s.arrive, s.depart)}n</small>
                <span aria-hidden>›</span>
              </button>))}
            {dayActs.length ? <div className="sp-list">{dayActs.map(a => (
              <div className="sp-card" key={a.id}><b>{a.time ? `${a.time} · ` : ''}{a.title}</b>
                <span className="sp-muted">{stops.find(s => s.id === a.stopId)?.name} · {a.status}</span></div>))}</div>
              : dayStops.length > 0 && <p className="sp-muted">Nothing planned.</p>}
        </div>
      </div> : <div role="region" aria-label="Manage trip stops" className="tp-stops-col"><StopEditor /></div>}
    </div>
  );
}
