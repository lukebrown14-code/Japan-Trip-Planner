import type { Activity, Flight, Leg, Stop, TripData } from '@shared/types';
import { journeyView, type JourneyView } from '../transport/viewModel';

export function japanClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: +get('hour') * 60 + +get('minute') };
}
export const timeMinutes = (time?: string) => {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
};
export type DayItem =
  | { kind: 'activity'; id: string; title: string; time?: string; minutes: number | null; endMinutes: null; activity: Activity; stop?: Stop }
  | { kind: 'travel'; id: string; title: string; time?: string; minutes: number | null; endMinutes: number | null; leg: Leg; from: Stop; to: Stop; continuing: boolean; journey: JourneyView }
  | { kind: 'flight'; id: string; title: string; time?: string; minutes: number | null; endMinutes: null; flight: Flight };

export function dayPlan(data: TripData, date: string) {
  const stops = [...data.stops].sort((a, b) => a.ord - b.ord);
  const stop = stops.filter(s => s.arrive <= date && date < s.depart).pop()
    ?? stops.filter(s => s.arrive <= date).pop() ?? stops[0];
  const items: DayItem[] = data.activities.filter(a => a.day === date).map(a => ({
    kind: 'activity', id: `activity-${a.id}`, title: a.title, time: a.time,
    minutes: timeMinutes(a.time), endMinutes: null, activity: a, stop: stops.find(s => s.id === a.stopId),
  }));
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i], to = stops[i + 1];
    const leg = data.legs.find(l => l.fromStop === from.id && l.toStop === to.id)
      ?? { id: `leg-${from.id}-${to.id}`, fromStop: from.id, toStop: to.id, status: 'to_book' as const };
    const journey = journeyView(data, `leg:${from.id}:${to.id}`);
    if (!journey?.date) continue;
    const start = timeMinutes(journey.departTime), end = timeMinutes(journey.arriveTime);
    const arrival = end === null ? null : end + journey.arriveDayOffset * 1440;
    const dayOffset = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${journey.date}T00:00:00Z`)) / 864e5;
    const continuing = dayOffset > journey.departDayOffset && arrival !== null && dayOffset <= Math.floor(arrival / 1440);
    if (dayOffset !== journey.departDayOffset && !continuing) continue;
    items.push({ kind: 'travel', id: `travel-${leg.id}`, title: journey.title,
      time: continuing ? undefined : journey.departTime, minutes: continuing ? 0 : start,
      endMinutes: arrival === null ? null : arrival - dayOffset * 1440,
      leg, from, to, continuing, journey });
  }
  for (const flight of data.flights) {
    const stamp = flight.direction === 'in' ? flight.arriveAt : flight.departAt;
    // Flight timestamps are local airport dates in the existing data contract.
    const flightDate = stamp?.slice(0, 10) ?? (flight.direction === 'in' ? data.trip.startDate : data.trip.endDate);
    if (flightDate !== date) continue;
    const time = stamp?.slice(11, 16);
    items.push({ kind: 'flight', id: `flight-${flight.id}`, title: flight.direction === 'in' ? `Arrive in Japan · ${flight.airport}` : `Flight home · ${flight.airport}`,
      time, minutes: timeMinutes(time), endMinutes: null, flight });
  }
  items.sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || a.id.localeCompare(b.id));
  return { stop, items };
}
export function nextItem(items: DayItem[], minutes: number, isToday: boolean) {
  const committed = items.filter(i => i.kind !== 'activity' || i.activity.status !== 'idea');
  if (!isToday) return committed[0];
  return committed.find(i => i.minutes !== null && (i.minutes >= minutes || (i.endMinutes !== null && i.endMinutes > minutes)))
    ?? committed.find(i => i.minutes === null);
}
