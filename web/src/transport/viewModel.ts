import type { BookStatus, TransportBooking, TransportSegment, TripData } from '@shared/types';
import { journeysChronological, journeyBooking, journeySegments, type Journey } from './planner';
import { journeyNextAction, journeyProgress } from './progress';

export interface ServiceView extends TransportSegment {
  departLabel: string; arriveLabel: string; statusLabel: string;
}
export interface TransferView {
  afterServiceId: string; minutes?: number; stationChanged: boolean; warning?: string;
}
export interface JourneyView {
  journey: Journey; key: string; title: string; date?: string;
  booking?: TransportBooking; services: ServiceView[]; transfers: TransferView[]; legacy: boolean;
  adults: number; currentAdults: number; status: 'arranged' | 'to_arrange' | 'needs_review'; arranged: boolean;
  nextAction: string; reviewReasons: string[]; missingDetails: string[];
  departTime?: string; arriveTime?: string; departDayOffset: number; arriveDayOffset: number;
  totalPaid?: number; confirmation?: string; notes?: string;
}
export const intercityJourneys = (data: TripData) => journeysChronological(data).filter(j => j.type === 'intercity');
export const serviceStatusLabel = (status: BookStatus) => ({ booked: 'Booked', to_book: 'To book', na: 'Pay on the day' })[status];
export const timeLabel = (time?: string, offset = 0) => time ? `${time}${offset ? ` (+${offset} day${offset === 1 ? '' : 's'})` : ''}` : 'Time not set';
export const formatJourneyDate = (date?: string) => date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'Date to confirm';
const minutes = (time?: string, offset = 0) => {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const [h,m] = time.split(':').map(Number); return offset * 1440 + h * 60 + m;
};
export function journeyView(data: TripData, key: string): JourneyView | undefined {
  const journey = intercityJourneys(data).find(j => j.key === key);
  if (!journey) return undefined;
  const booking = journeyBooking(data, journey);
  const saved = journeySegments(data, journey);
  const leg = data.legs.find(l => l.fromStop === journey.fromStopId && l.toStop === journey.toStopId);
  const legacy = !Array.isArray(booking?.segments);
  const progress = journeyProgress(data, journey);
  const meaningfulLeg = leg && (leg.departTime || leg.arriveTime || leg.summary || leg.confirmation || leg.notes);
  const source: TransportSegment[] = !legacy ? saved : meaningfulLeg && leg ? [{ id: `legacy-${leg.id}`.slice(0,40), ord: 0,
    service: leg.summary,
    departTime: leg.departTime, arriveTime: leg.arriveTime,
    arriveDayOffset: leg.departTime && leg.arriveTime && leg.arriveTime <= leg.departTime ? 1 : 0,
    status: progress.status === 'booked' ? (leg.status === 'na' ? 'na' : 'booked') : 'to_book',
    confirmation: leg.confirmation, instructions: leg.notes }] : [];
  const services = source.map(s => ({ ...s, departLabel: timeLabel(s.departTime, s.departDayOffset),
    arriveLabel: timeLabel(s.arriveTime, s.arriveDayOffset), statusLabel: serviceStatusLabel(s.status) }));
  const reviewReasons: string[] = [];
  if (!journey.date) reviewReasons.push('Confirm the travel date.');
  if (booking && booking.travelDate !== journey.date) reviewReasons.push(`Travel date changed from ${formatJourneyDate(booking.travelDate)} to ${formatJourneyDate(journey.date)}.`);
  if (booking && booking.routeKey !== journey.routeKey) reviewReasons.push('The route has changed. Check that your tickets still fit.');
  if (progress.needsReview && (booking?.adults ?? 2) !== (data.transportPlans?.find(p => p.id === 'transport')?.adults ?? 2)) reviewReasons.push('The traveller count has changed.');
  if (progress.needsReview && !reviewReasons.length) reviewReasons.push('Check that your saved tickets fit the updated journey.');
  const missingDetails: string[] = [];
  if (legacy || !services.length) missingDetails.push('Add your confirmed services.');
  for (const [i,s] of services.entries()) {
    if (!s.departTime || !s.arriveTime) missingDetails.push(`Service ${i+1}: times not set.`);
    if (!s.fromStation || !s.toStation) missingDetails.push(`Service ${i+1}: stations not set.`);
    if (!s.service) missingDetails.push(`Service ${i+1}: service name not set.`);
  }
  const transfers: TransferView[] = services.slice(0,-1).map((s,i) => {
    const next=services[i+1]; const arrival=minutes(s.arriveTime,s.arriveDayOffset); const departure=minutes(next.departTime,next.departDayOffset);
    const interval=arrival === undefined || departure === undefined ? undefined : departure-arrival;
    return { afterServiceId:s.id, minutes:interval, stationChanged:!!s.toStation && !!next.fromStation && s.toStation.trim().toLowerCase() !== next.fromStation.trim().toLowerCase(),
      warning:interval !== undefined && interval < 0 ? 'The next service leaves before this one arrives. Check the times and days.' : undefined };
  });
  const first=services[0], last=services.at(-1);
  const arranged=progress.ready;
  const nextAction=journeyNextAction(progress, legacy);
  return { journey, key, title:journey.title, date:journey.date, booking, services, transfers, legacy,
    adults:booking?.adults ?? data.transportPlans?.find(p=>p.id==='transport')?.adults ?? 2,
    currentAdults:data.transportPlans?.find(p=>p.id==='transport')?.adults ?? 2,
    status:progress.needsReview?'needs_review':arranged?'arranged':'to_arrange', arranged,nextAction,reviewReasons,missingDetails,
    departTime:first?.departTime, arriveTime:last?.arriveTime, departDayOffset:first?.departDayOffset ?? 0, arriveDayOffset:last?.arriveDayOffset ?? 0,
    totalPaid:legacy ? booking?.cost ?? leg?.cost : booking?.cost ?? undefined,
    confirmation:legacy ? booking?.confirmation ?? leg?.confirmation : booking?.confirmation ?? undefined,
    notes:legacy ? booking?.notes ?? leg?.notes : booking?.notes ?? undefined };
}
export const journeyViews = (data: TripData) => intercityJourneys(data).map(j=>journeyView(data,j.key)!);
