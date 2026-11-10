import type { Stop } from '@shared/types';
import { useStore } from '../../store';
import { journeyView, timeLabel } from '../../transport/viewModel';
import { transportHref } from '../../transport/routes';
import { navClick } from '../../nav';

export function IncomingLeg({ stop }: { stop: Stop }) {
  const data = useStore(s => s.data);
  const stops = [...data.stops].sort((a, b) => a.ord - b.ord);
  const index = stops.findIndex(s => s.id === stop.id);
  if (index < 1) return null;
  const stationMap = (station: string, city: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station} ${city} Japan`)}`;
  const journey = journeyView(data, `leg:${stops[index - 1].id}:${stop.id}`);
  if (!journey) return null;
  return <section className="sp-incoming" aria-label="Travel to this city">
    <div className="sp-sec">GETTING HERE</div>
    <div className="sp-card">
      <b>{journey.title}</b>
      <span className="sp-muted">{timeLabel(journey.departTime, journey.departDayOffset)} → {timeLabel(journey.arriveTime, journey.arriveDayOffset)}</span>
      <span className={`chip ${journey.arranged ? 'booked' : 'none'}`}>{journey.status === 'needs_review' ? 'Needs review' : journey.arranged ? 'Arranged' : journey.nextAction}</span>
      {journey.services.map((service, serviceIndex) => <div key={service.id}>
        <b>{service.service || 'Service not set'}</b>
        <div className="sp-muted">{service.departLabel} · {service.fromStation || 'Departure station not set'}</div>
        <div className="sp-muted">{service.arriveLabel} · {service.toStation || 'Arrival station not set'}</div>
        <span className="sp-muted">{service.statusLabel}</span>
        {service.confirmation && <div>Reference: {service.confirmation}</div>}
        {service.seatDetails && <div>Seats: {service.seatDetails}</div>}
        {service.instructions && <p>{service.instructions}</p>}
        {service.fromStation && <div><a href={stationMap(service.fromStation, serviceIndex === 0 ? journey.journey.from : '')} target="_blank" rel="noreferrer">Departure station map ↗</a></div>}
        {service.toStation && <div><a href={stationMap(service.toStation, serviceIndex === journey.services.length - 1 ? journey.journey.to : '')} target="_blank" rel="noreferrer">Arrival station map ↗</a></div>}
        {journey.transfers.filter(t => t.afterServiceId === service.id).map(t => <p className="sp-muted" key={t.afterServiceId}>{t.warning || `${t.minutes === undefined ? 'Transfer time not set' : `${t.minutes} min transfer`}${t.stationChanged ? ' · Change stations' : ''}`}</p>)}
      </div>)}
      {journey.confirmation && <div>Journey reference: {journey.confirmation}</div>}
      {journey.notes && <p>{journey.notes}</p>}
      {journey.reviewReasons.map(reason => <p key={reason}>{reason}</p>)}
      <a href={transportHref(journey.key)} onClick={navClick}>View journey in Transport →</a>
    </div>
  </section>;
}
