import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { navClick, navigate, usePath } from '../../nav';
import { transportHref, transportRouteKey } from '../../transport/routes';
import { intercityOrphanBookings } from '../../transport/progress';
import { formatJourneyDate, journeyViews, serviceStatusLabel, timeLabel } from '../../transport/viewModel';
import JourneyDetail, { Reference, ServiceCard } from './JourneyDetail';
import JourneyEditor from './JourneyEditor';
import './workspace.css';

export default function TransportWorkspace() {
  const data = useStore(s => s.data);
  const path = usePath();
  const key = transportRouteKey(path);
  const detailRoute = path.startsWith('/transport/journeys/');
  const previousPath = useRef(path);
  const views = journeyViews(data);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [editingKey, setEditingKey] = useState<string>();
  const detail = useRef<HTMLElement>(null);
  useEffect(() => {
    detail.current?.scrollTo({ top: 0 });
    if (detailRoute) detail.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    else if (previousPath.current !== path) document.querySelector<HTMLElement>('.ws-list-intro h2')?.focus({ preventScroll: true });
    previousPath.current = path;
  }, [path, editingKey]);
  useEffect(() => { if (key !== editingKey) setEditingKey(undefined); }, [path]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  const needsAttention = (v: typeof views[number]) => !v.arranged || v.missingDetails.length > 0;
  const selected = detailRoute ? views.find(v => v.key === key) : views.find(needsAttention) ?? views.find(v => v.date && v.date >= today) ?? views[0];
  const shown = filter === 'all' ? views : views.filter(needsAttention);
  const orphan = intercityOrphanBookings(data);
  const arranged = views.filter(v => v.arranged).length;
  return <main className={`ws-page ${detailRoute ? 'ws-has-detail' : ''}`}><header className="ws-header"><div><p className="ws-eyebrow">Your Japan trip</p><h1>Transport</h1></div><nav aria-label="Trip navigation"><a href="/" onClick={navClick}>Map</a><a href="/today" onClick={navClick}>Today</a></nav></header>
    <div className="ws-layout"><aside className="ws-sidebar" aria-label="Intercity journeys"><div className="ws-list-intro"><h2 tabIndex={-1}>Between cities</h2><p>Know what is arranged and what comes next.</p><div className="ws-progress"><strong>{arranged}<span> / {views.length}</span></strong><span>journeys arranged</span><progress value={arranged} max={views.length || 1} aria-label={`${arranged} of ${views.length} journeys arranged`} /></div><div className="ws-filters" aria-label="Filter journeys"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All journeys</button><button aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Needs attention <span>{views.filter(needsAttention).length}</span></button></div></div>
    <div className="ws-journey-list">{shown.map(view => <a className={`ws-journey-row ${selected?.key === view.key ? 'ws-selected' : ''}`} key={view.key} href={transportHref(view.key)} onClick={navClick} aria-current={selected?.key === view.key ? 'page' : undefined}><span className="ws-row-date">{formatJourneyDate(view.date)}</span><strong className="ws-row-title">{view.title}</strong><span className="ws-row-meta">{view.departTime || view.arriveTime ? `${timeLabel(view.departTime, view.departDayOffset)} → ${timeLabel(view.arriveTime, view.arriveDayOffset)}` : 'Times to confirm'} · {view.services.length} service{view.services.length === 1 ? '' : 's'}</span><span className={`ws-badge ws-badge-${view.status}`}>{view.status === 'needs_review' ? 'Needs review' : view.arranged ? 'Arranged' : 'To arrange'}</span><span className="ws-next-action">{view.nextAction}{view.arranged && view.missingDetails.length > 0 ? ' · Complete travel details' : ''}<span aria-hidden="true"> →</span></span></a>)}{shown.length === 0 && <div className="ws-empty"><h3>{views.length ? 'All caught up' : 'No intercity journeys yet'}</h3><p>{views.length ? 'Your journeys are arranged and their travel details are complete.' : 'Add cities to your itinerary to plan travel between them.'}</p>{!views.length && <a className="ws-button" href="/" onClick={navClick}>Open trip map</a>}</div>}</div>
    {orphan.length > 0 && <section className="ws-orphans"><h2>Saved bookings to review</h2><p>These bookings no longer match a journey. Your saved details are kept here.</p>{orphan.map(b => <details key={b.id}><summary>{formatJourneyDate(b.travelDate)} · {b.routeKey || 'Saved journey'}<span className="ws-badge ws-badge-needs_review">Needs review</span></summary><div className="ws-orphan-content"><p>{b.adults ?? 2} travellers · {b.payOnDay ? 'Pay on the day' : b.purchased ? 'Purchased' : 'Not purchased'} · {b.seatReserved ? 'Seats reserved' : 'Seats not marked reserved'}</p>{b.selectedOption && <p>Saved option: {b.selectedOption}</p>}{b.confirmation && <Reference value={b.confirmation} />}{b.cost !== undefined && <p>Group total paid: ¥{b.cost.toLocaleString('en-AU')}</p>}{b.fareEstimate !== undefined && <p>Saved fare estimate: ¥{b.fareEstimate.toLocaleString('en-AU')}</p>}{b.notes && <p className="ws-note">{b.notes}</p>}{[...(b.segments ?? [])].sort((a,c) => a.ord-c.ord).map((s,i) => <ServiceCard key={s.id} index={i} service={{...s, departLabel:timeLabel(s.departTime,s.departDayOffset),arriveLabel:timeLabel(s.arriveTime,s.arriveDayOffset),statusLabel:serviceStatusLabel(s.status)}} />)}</div></details>)}</section>}
    </aside><section className="ws-detail" ref={detail} aria-label="Journey details"><button className="ws-back ws-button" onClick={() => navigate(transportHref())}>← All journeys</button>{editingKey && key === editingKey ? <JourneyEditor key={editingKey} journeyKey={editingKey} onSaved={() => setEditingKey(undefined)} onCancel={() => setEditingKey(undefined)} /> : detailRoute && !selected ? <div className="ws-empty"><h2 tabIndex={-1}>Journey no longer available</h2><p>Your itinerary has changed. Any saved booking details are retained under Saved bookings to review.</p><a className="ws-button" href={transportHref()} onClick={navClick}>Back to journeys</a></div> : selected ? <JourneyDetail key={selected.key} view={selected} onEdit={() => { if (!key) navigate(transportHref(selected.key)); setEditingKey(selected.key); }} /> : <div className="ws-empty ws-detail-empty"><span aria-hidden="true">↗</span><h2>The next stop starts here</h2><p>Your intercity travel will appear as you add cities to the trip.</p></div>}</section></div>
  </main>;
}
