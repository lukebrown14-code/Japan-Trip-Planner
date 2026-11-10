import { useEffect, useMemo, useRef, useState } from 'react';
import type { Stop, TripData } from '@shared/types';
import type { WeatherDay } from '@shared/api';
import { api } from '../api';
import { useStore } from '../store';
import { legRoute, dayInfo, dayCount } from '../timeline';
import { dayPlan, japanClock, nextItem, type DayItem } from './dayPlan';
import { navClick } from '../nav';
import { transportHref } from '../transport/routes';
import './today.css';

const CACHE_KEY = 'japan-today-cache-v1';
const SAVED_KEY = 'japan-today-saved-at';
const gm = (lat?: number, lng?: number, q = '') => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat != null && lng != null ? `${q} ${lat},${lng}` : q)}`;
const WX = (c: number) => c === 0 ? 'Clear' : c < 4 ? 'Partly cloudy' : c < 50 ? 'Fog' : c < 70 ? 'Rain' : c < 80 ? 'Snow' : c < 90 ? 'Showers' : 'Storm';
function readCache(): TripData | null {
  try {
    const d = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return d?.trip?.startDate && ['stops', 'legs', 'activities', 'flights'].every(k => Array.isArray(d[k])) ? d : null;
  } catch { return null; }
}
function saveCache(data: TripData) {
  try {
    const saved = new Date().toISOString();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(SAVED_KEY, saved);
    return saved;
  } catch { return null; }
}
function readSaved() {
  try { return localStorage.getItem(SAVED_KEY); } catch { return null; }
}
function savedLabel(saved: string | null) {
  if (!saved || !Number.isFinite(Date.parse(saved))) return 'Saved copy';
  return `Saved ${new Intl.DateTimeFormat('en-AU', { timeZone: 'Asia/Tokyo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(saved))} JST`;
}
function directions(item: DayItem) {
  if (item.kind === 'activity') {
    const a = item.activity;
    return gm(a.lat ?? a.destLat, a.lng ?? a.destLng, `${a.title} ${item.stop?.name ?? ''}`);
  }
  if (item.kind === 'flight') return gm(undefined, undefined, `${item.flight.airport} airport Japan`);
  return gm(item.to.lat, item.to.lng, item.to.name);
}
function Taxi({ stop, onClose }: { stop: Stop; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const addr = stop.hotelAddressJa || stop.hotelName || stop.nameJa;
  return <dialog ref={ref} className="taxi" aria-label="Show to taxi driver" onCancel={onClose}>
    <div className="en">{stop.hotelName || stop.name}</div>
    <div className="jp" lang="ja">{addr}</div>
    <div className="please" lang="ja">ここまでお願いします</div>
    <div className="en">Please take me here</div>
    <a className="btn alt" href={gm(stop.hotelLat, stop.hotelLng, stop.hotelName || addr)} target="_blank" rel="noreferrer">Open in Google Maps</a>
    <button className="btn" onClick={onClose}>Close</button>
  </dialog>;
}
function DayRow({ item, data, next }: { item: DayItem; data: TripData; next: boolean }) {
  const status = item.kind === 'activity' ? item.activity.status : item.kind === 'travel' ? item.journey.arranged ? 'booked' : 'to_book' : item.flight.status;
  const route = item.kind === 'travel' && item.journey.legacy ? legRoute(data, item.leg) : null;
  return <details className={`day-entry${next ? ' next' : ''}`} id={item.id}>
    <summary>
      <span className="entry-time">{item.kind === 'travel' && item.continuing ? 'En route' : item.time || (item.kind === 'activity' ? 'Any time' : 'Time TBC')}</span>
      <span className="entry-main"><strong>{item.title}</strong><span className="entry-meta">{item.kind === 'activity' ? item.stop?.name : item.kind === 'travel' ? 'City transfer' : 'Flight'}{next ? ' · Up next' : ''}</span></span>
      <span className="entry-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="entry-details">
      <span className={`st ${status}`}>{item.kind === 'travel' ? item.journey.status === 'arranged' ? 'Arranged' : item.journey.status === 'needs_review' ? 'Needs review' : item.journey.nextAction : status === 'to_book' ? 'To book' : status === 'na' ? 'No booking needed' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
      {item.kind === 'activity' && <>
        {item.activity.category && <span>{item.activity.category}</span>}
        {item.activity.confirmation && <span>Confirmation: <b>{item.activity.confirmation}</b></span>}
        {item.activity.url && <a href={item.activity.url} target="_blank" rel="noreferrer">Website ↗</a>}
      </>}
      {item.kind === 'travel' && <>
        <ol className="today-services">{item.journey.services.map((service, index) => {
          const transfer = item.journey.transfers.find(t => t.afterServiceId === service.id);
          return <li key={service.id}>
            <strong>{service.service || 'Service not set'}</strong><span>{service.statusLabel}</span>
            <div>{service.departLabel} · {service.fromStation || 'Departure station not set'}</div>
            <div>{service.arriveLabel} · {service.toStation || 'Arrival station not set'}</div>
            {service.confirmation && <div>Reference: <b>{service.confirmation}</b></div>}
            {service.seatDetails && <div>Seats: {service.seatDetails}</div>}
            {service.instructions && <p>{service.instructions}</p>}
            {service.fromStation && <a href={gm(undefined, undefined, `${service.fromStation} ${index === 0 ? item.from.name : ''} Japan`)} target="_blank" rel="noreferrer">Departure station map ↗</a>}
            {service.toStation && <a href={gm(undefined, undefined, `${service.toStation} ${index === item.journey.services.length - 1 ? item.to.name : ''} Japan`)} target="_blank" rel="noreferrer">Arrival station map ↗</a>}
            {transfer && <p className={transfer.warning ? 'today-transfer-warning' : 'muted'}>{transfer.warning || `${transfer.minutes === undefined ? 'Transfer time not set' : `${transfer.minutes} min transfer`}${transfer.stationChanged ? ' · Change stations' : ''}`}</p>}
          </li>;
        })}</ol>
        {route && route.steps.length > 0 && <><span className="muted">Suggested route · check the timetable before travelling</span><ul>{route.steps.map((s, i) => <li key={i}>{s.line ?? s.mode} · {s.minutes} min</li>)}</ul></>}
        {item.journey.confirmation && <span>Journey reference: <b>{item.journey.confirmation}</b></span>}
        {item.journey.totalPaid !== undefined && <span>Group total paid: ¥{item.journey.totalPaid.toLocaleString()}</span>}
        {item.journey.notes && <p>{item.journey.notes}</p>}
        {item.journey.reviewReasons.map(reason => <p className="today-transfer-warning" key={reason}>{reason}</p>)}
        {item.journey.missingDetails.map(detail => <p className="muted" key={detail}>{detail}</p>)}
        <a href={transportHref(item.journey.key)} onClick={navClick}>Open journey in Transport →</a>
      </>}
      {item.kind === 'flight' && <>
        <span>{[item.flight.airline, item.flight.number].filter(Boolean).join(' ') || 'Flight details not set'}</span>
        {!item.time && <span>Time not set</span>}
        {item.flight.confirmation && <span>Confirmation: <b>{item.flight.confirmation}</b></span>}
      </>}
      <a href={directions(item)} target="_blank" rel="noreferrer">{item.kind === 'travel' ? 'Destination in Google Maps' : 'Directions in Google Maps'} ↗</a>
    </div>
  </details>;
}
export function TodayView() {
  const storeData = useStore(s => s.data);
  const [data, setData] = useState<TripData>(() => readCache() ?? storeData);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [loadError, setLoadError] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [saved, setSaved] = useState<string | null>(() => readSaved());
  const [retry, setRetry] = useState(0);
  const [clock, setClock] = useState(() => japanClock());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [taxi, setTaxi] = useState(false);
  const [wx, setWx] = useState<WeatherDay | null>(null);
  const activeDay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!(import.meta as any).env.DEV && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const timer = window.setInterval(() => setClock(japanClock()), 30000);
    const online = () => { setOffline(false); setRetry(r => r + 1); };
    const offline = () => setOffline(true);
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    return () => { clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);
  useEffect(() => {
    let live = true;
    api.trip().then(d => {
      if (!live) return;
      setData(d); setOffline(!navigator.onLine); setLoadError(false); setHasLiveData(true);
      setSaved(saveCache(d)); useStore.getState().set({ data: d });
    }).catch(() => {
      if (!live) return;
      setLoadError(true); setOffline(!navigator.onLine);
      const cached = readCache(); if (cached) setData(cached);
    });
    return () => { live = false; };
  }, [retry]);
  useEffect(() => {
    if (!hasLiveData || offline || loadError) return;
    setData(storeData); setSaved(saveCache(storeData));
  }, [storeData, hasLiveData, offline, loadError]);

  const today = clock.date;
  const inTrip = today >= data.trip.startDate && today <= data.trip.endDate;
  const defaultDate = inTrip ? today : today < data.trip.startDate ? data.trip.startDate : data.trip.endDate;
  const date = selectedDate && selectedDate >= data.trip.startDate && selectedDate <= data.trip.endDate ? selectedDate : defaultDate;
  const days = useMemo(() => Array.from({ length: Math.max(0, dayCount(data)) }, (_, i) => dayInfo(data, i)), [data]);
  const day = days.find(d => d.iso === date);
  const { stop, items } = useMemo(() => dayPlan(data, date), [data, date]);
  const isToday = date === today;
  const next = nextItem(items, clock.minutes, isToday);
  const hotelAvailable = !!stop && !!(stop.hotelName || stop.hotelAddressJa);
  const stayingTonight = !!stop && date < stop.depart;
  const transfer = items.find(i => i.kind === 'travel');
  const heading = transfer?.kind === 'travel' ? `${transfer.from.name} → ${transfer.to.name}` : stop?.name ?? 'Your trip';

  useEffect(() => { activeDay.current?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [date]);
  useEffect(() => { setTaxi(false); }, [date]);
  useEffect(() => {
    setWx(null); if (!stop || offline) return;
    let live = true;
    api.weather(stop.lat, stop.lng, date).then(w => { if (live) setWx(w ?? null); }).catch(() => {});
    return () => { live = false; };
  }, [stop?.id, date, offline, retry]);

  return <main className="today"><div className="today-in">
    <header className="today-header"><a className="back" href="/" onClick={navClick}>← Explore map</a><a className="back" href={transportHref()} onClick={navClick}>Transport →</a><span className="today-clock">Japan · {String(Math.floor(clock.minutes / 60)).padStart(2, '0')}:{String(clock.minutes % 60).padStart(2, '0')} JST</span></header>
    <div className="today-title"><span className="eyebrow">{isToday ? 'Today' : today > data.trip.endDate ? 'Trip memories' : 'Your daily plan'}{day ? ` · Day ${days.indexOf(day) + 1} of ${days.length}` : ''}</span><h1>{heading}</h1><p>{day ? `${day.weekday}, ${day.date}` : date}{!transfer && stop?.nameJa && <span lang="ja"> · {stop.nameJa}</span>}</p></div>
    <nav className="chips" aria-label="Choose itinerary day">{days.map(d => <button ref={d.iso === date ? activeDay : undefined} key={d.iso} aria-current={d.iso === date ? 'date' : undefined} className={`chip${d.iso === date ? ' on' : ''}`} onClick={() => setSelectedDate(d.iso)}><span>{d.iso === today ? 'Today' : d.weekday}</span><strong>{d.date}</strong></button>)}</nav>
    {!isToday && <div className="preview-note"><span>{today < data.trip.startDate ? 'A look ahead at your trip.' : today > data.trip.endDate ? 'Revisit a day from your trip.' : 'Previewing another day.'}</span>{inTrip && <button onClick={() => setSelectedDate(null)}>Back to today</button>}</div>}
    {(offline || loadError) && <div className="connection-note" role="status"><span>{offline ? 'You’re offline.' : 'Couldn’t refresh the trip.'} {readCache() ? `${savedLabel(saved)}. Maps and links need a connection.` : 'No saved trip available on this phone.'}</span>{!offline && <button onClick={() => setRetry(r => r + 1)}>Retry</button>}</div>}
    {stop && !(loadError && !readCache()) ? <>
      <section className="card up-next" aria-labelledby="up-next-title">
        <div className="section-top"><h2 id="up-next-title">{isToday ? 'Up next' : 'First on the plan'}</h2><span className="next-time">{next?.time || (next ? next.kind === 'travel' && next.continuing ? 'En route' : next.kind === 'activity' ? 'Flexible' : 'Time to confirm' : 'Take it easy')}</span></div>
        <h3>{next?.title || (items.length ? isToday ? 'The rest of the day is yours' : 'Room to explore' : 'A little room for adventure')}</h3>
        <p>{next ? next.kind === 'activity' ? next.activity.status === 'booked' ? 'Booked and ready to go.' : 'On your plan for the day.' : next.kind === 'travel' ? 'Check your tickets and departure time before heading out.' : 'Keep your passport and flight confirmation handy.' : 'Browse your saved ideas or enjoy an unhurried day.'}</p>
        {next && <div className="hero-actions"><a className="btn" href={`#${next.id}`} onClick={() => { const row = document.getElementById(next.id); if (row instanceof HTMLDetailsElement) row.open = true; }}>View details ↓</a><a className="btn alt" href={directions(next)} target="_blank" rel="noreferrer">{next.kind === 'travel' ? 'Destination ↗' : 'Directions ↗'}</a></div>}
      </section>
      <nav className="quick-actions" aria-label="Day shortcuts"><a href="#day-schedule">Day’s plan ↓</a><a href="#today-hotel">Hotel ↓</a><button disabled={!hotelAvailable} onClick={() => setTaxi(true)}>Show to taxi</button></nav>
      {wx && <section className="weather-strip" aria-label={`Weather${wx.kind === 'typical' ? ', typical conditions' : ''}`}><span><strong>{Math.round(wx.tmax)}° / {Math.round(wx.tmin)}°</strong> {WX(wx.code)}</span><span>{wx.kind === 'typical' ? 'Typical conditions' : 'Forecast'}{wx.rainPct != null ? ` · Rain ${wx.rainPct}%` : ''}</span></section>}
      <section className="card schedule" id="day-schedule" aria-labelledby="schedule-title"><div className="section-top"><h2 id="schedule-title">Your day</h2><span className="muted">Times in Japan</span></div>{items.length ? items.map(item => <DayRow key={`${date}-${item.id}`} item={item} data={data} next={item.id === next?.id} />) : <div className="empty-day"><strong>Nothing scheduled yet</strong><p>Keep it spontaneous, or add something from the city’s ideas.</p><a className="text-link" href="/">Explore the trip →</a></div>}</section>
      <section className="card hotel" id="today-hotel" aria-labelledby="hotel-title"><div className="section-top"><h2 id="hotel-title">{stayingTonight ? 'Tonight’s hotel' : 'Hotel details'}</h2><span className={`st ${stop.hotelStatus}`}>{stop.hotelStatus === 'booked' ? 'Booked' : stop.hotelStatus === 'idea' ? 'Considering' : 'Not booked'}</span></div><h3>{stop.hotelName || 'Hotel not set yet'}</h3><p className="muted">{stop.name}{!stayingTonight ? ' · Departure day' : ''}</p>{stop.hotelAddressJa && <p lang="ja">{stop.hotelAddressJa}</p>}{stop.hotelConfirmation && <div className="confirmation"><span>Confirmation</span><strong>{stop.hotelConfirmation}</strong></div>}{hotelAvailable ? <div className="hero-actions"><a className="btn" href={gm(stop.hotelLat, stop.hotelLng, stop.hotelName || stop.hotelAddressJa)} target="_blank" rel="noreferrer">Hotel directions ↗</a><button className="btn alt" onClick={() => setTaxi(true)}>Show to taxi</button></div> : <p>Add your hotel in the city panel to keep its address handy here.</p>}</section>
    </> : <section className="card"><h2>{loadError ? "Your trip couldn’t load" : "No stops yet"}</h2><p>{loadError ? "Connect to the internet and retry to save your itinerary on this phone." : "Add your first city to start building a daily plan."}</p><a className="text-link" href="/">Explore the map →</a></section>}
    {!offline && !loadError && <p className="save-status">{saved ? `${savedLabel(saved)} on this phone` : 'Offline saving unavailable on this phone'}</p>}
  </div>{taxi && stop && <Taxi stop={stop} onClose={() => setTaxi(false)} />}</main>;
}
