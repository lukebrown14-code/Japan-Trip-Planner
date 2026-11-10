import { useState } from 'react';
import type { ServiceView, JourneyView } from '../../transport/viewModel';
import { formatJourneyDate } from '../../transport/viewModel';
import { confirmJourneyReview } from '../../transport/saveJourney';
import { safeBookingUrl } from '../../transport/bookingUrl';

export function StationLink({ station, city }: { station?: string; city?: string }) {
  if (!station) return <span>Station not set</span>;
  return <a className="ws-station" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station} station ${city ?? ''} Japan`)}`} target="_blank" rel="noopener noreferrer">{station}<span aria-hidden="true"> ↗</span><span className="ws-sr"> (open map)</span></a>;
}
export function Reference({ value }: { value: string }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setMessage('Copied'); }
    catch { setMessage('Copy unavailable. Select the reference to copy it.'); }
  }
  return <div className="ws-reference"><span><small>Booking reference</small><strong>{value}</strong></span><button className="ws-button ws-button-subtle" onClick={copy}>Copy</button><span role="status">{message}</span></div>;
}
export function ServiceCard({ service, index, fromCity, toCity }: { service: ServiceView; index: number; fromCity?: string; toCity?: string }) {
  const bookingUrl = safeBookingUrl(service.bookingUrl);
  return <article className="ws-service"><div className="ws-service-top"><span className="ws-service-number">{index + 1}</span><h3>{service.service || 'Service name not set'}</h3><span className={`ws-badge ${service.status === 'to_book' ? 'ws-badge-pending' : ''}`}>{service.statusLabel}</span></div>
    <div className="ws-endpoints"><div><strong className="ws-time">{service.departLabel}</strong><StationLink station={service.fromStation} city={fromCity} /><small>Departure</small></div><span className="ws-route-line" aria-hidden="true">↓</span><div><strong className="ws-time">{service.arriveLabel}</strong><StationLink station={service.toStation} city={toCity} /><small>Arrival</small></div></div>
    {bookingUrl && <p><a className="ws-button ws-button-subtle" href={bookingUrl} target="_blank" rel="noopener noreferrer">Booking / tickets<span aria-hidden="true"> ↗</span><span className="ws-sr"> for {service.service || `service ${index + 1}`} (opens in new tab)</span></a></p>}
    {service.confirmation && <Reference value={service.confirmation} />}
    {service.seatDetails && <p className="ws-note"><strong>Seats</strong><br />{service.seatDetails}</p>}
    {service.instructions && <p className="ws-note"><strong>Collection & travel instructions</strong><br />{service.instructions}</p>}
  </article>;
}
export default function JourneyDetail({ view, onEdit }: { view: JourneyView; onEdit: () => void }) {
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  async function review() { setReviewing(true); setError(''); try { await confirmJourneyReview(view.key); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save review. Try again.'); } finally { setReviewing(false); } }
  return <div className="ws-detail-content"><header className="ws-detail-heading"><p className="ws-eyebrow">{formatJourneyDate(view.date)} · {view.adults} travellers</p><h2 tabIndex={-1}>{view.title}</h2><div className="ws-detail-actions"><span className={`ws-badge ws-badge-${view.status}`}>{view.status === 'needs_review' ? 'Needs review' : view.arranged ? 'Arranged' : 'To arrange'}</span><button className="ws-button ws-button-primary" onClick={onEdit}>Edit journey</button></div><p className="ws-detail-next">{view.nextAction}</p></header>
    {view.reviewReasons.length > 0 && <section className="ws-warning" aria-label="Journey needs review"><h3>Check your saved booking</h3><ul>{view.reviewReasons.map(reason => <li key={reason}>{reason}</li>)}</ul><button className="ws-button" disabled={reviewing || !view.date} onClick={review}>{reviewing ? 'Saving…' : 'I have checked these details'}</button>{error && <p role="alert">{error}</p>}</section>}
    {view.missingDetails.length > 0 && <section className="ws-info"><h3>Details to complete</h3><ul>{view.missingDetails.map(detail => <li key={detail}>{detail}</li>)}</ul></section>}
    <section aria-label="Journey services" className="ws-services">{view.services.length === 0 ? <div className="ws-empty"><h3>Your services go here</h3><p>Add the trains or buses you will take, including their times and stations.</p><button className="ws-button" onClick={onEdit}>Add services</button></div> : view.services.map((service, index) => { const transfer = view.transfers.find(t => t.afterServiceId === service.id); return <div key={service.id}><ServiceCard service={service} index={index} fromCity={index === 0 ? view.journey.from : undefined} toCity={index === view.services.length - 1 ? view.journey.to : undefined} />{transfer && <div className={`ws-transfer ${transfer.warning ? 'ws-transfer-warning' : ''}`}><span aria-hidden="true">↳</span><div><strong>{transfer.minutes === undefined ? 'Connection time not set' : transfer.minutes < 0 ? 'Check this connection' : `${transfer.minutes} min connection`}</strong>{transfer.stationChanged && <span>Change stations: {service.toStation} → {view.services[index + 1]?.fromStation}</span>}{transfer.warning && <span>{transfer.warning}</span>}</div></div>}</div>; })}</section>
    {(view.confirmation || view.totalPaid !== undefined || view.notes) && <section className="ws-booking"><h3>Journey booking</h3>{view.confirmation && <Reference value={view.confirmation} />}{view.totalPaid !== undefined && <p><small>Group total paid</small><strong className="ws-paid">¥{view.totalPaid.toLocaleString('en-AU')}</strong></p>}{view.notes && <p className="ws-note"><strong>Notes</strong><br />{view.notes}</p>}</section>}
  </div>;
}
