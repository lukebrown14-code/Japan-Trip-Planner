import type { TripData, TransportBooking, TransportSegment } from './types';

export const TRAVEL_IMPORT_VERSION = 'travel-bookings-2026-10-05-v1';
const clone = <T>(value: T): T => structuredClone(value);
const stationKey = (value?: string) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sameService = (a: TransportSegment, b: TransportSegment) => a.id === b.id ||
  (!!stationKey(a.fromStation) && !!stationKey(a.toStation) && stationKey(a.fromStation) === stationKey(b.fromStation) && stationKey(a.toStation) === stationKey(b.toStation));
const uniqueId = (preferred: string, entities: { id: string }[]) => {
  let id = preferred;
  for (let n = 1; entities.some(e => e.id === id); n++) id = `${preferred}-${n}`;
  return id;
};

/** Import the supplied reservations once, preserving unrelated saved trip data and service details. */
export function importTravelBookings(saved: TripData, supplied: TripData): TripData | null {
  if (saved.trip.startDate !== supplied.trip.startDate || saved.trip.endDate !== supplied.trip.endDate) return null;
  const data = clone(saved);
  const stopMap = new Map<string, string>();
  const ordered = [...data.stops].sort((a, b) => a.ord - b.ord);
  for (const [index, source] of supplied.stops.slice(0, 6).entries()) {
    const target = ordered[index]?.cityKey === source.cityKey ? ordered[index] : undefined;
    if (!target) return null;
    stopMap.set(source.id, target.id);
  }
  const finalSource = supplied.stops[6];
  let final = data.stops.find(s => s.cityKey === finalSource.cityKey && s.arrive === finalSource.arrive && s.depart === finalSource.depart);
  if (!final && ordered.length === 6 && ordered[5].depart === finalSource.arrive) {
    final = { ...clone(finalSource), id: uniqueId(finalSource.id, data.stops), ord: Math.max(...data.stops.map(s => s.ord)) + 1 };
    data.stops.push(final);
  }
  if (final) stopMap.set(finalSource.id, final.id);
  const legMap = new Map<string, string>();
  for (const source of supplied.legs) {
    const fromStop = stopMap.get(source.fromStop)!;
    const toStop = stopMap.get(source.toStop);
    if (!toStop) continue;
    let target = data.legs.find(l => l.fromStop === fromStop && l.toStop === toStop);
    if (!target) {
      target = { id: uniqueId(source.id, data.legs), fromStop, toStop, status: 'to_book' };
      data.legs.push(target);
    }
    legMap.set(source.id, target.id);
  }
  if (!data.transportPlans?.length) data.transportPlans = clone(supplied.transportPlans ?? []);
  data.transportBookings ??= [];
  // Older itineraries stored Hakone → Tokyo services inside the airport transfer.
  const outbound = data.transportBookings.find(b => b.sourceType === 'flight' &&
    data.flights.some(f => f.id === b.sourceId && f.direction === 'out' && f.airport === 'NRT'));
  const moved = (outbound?.segments ?? []).filter(s => (supplied.transportBookings?.find(b => b.routeKey === 'hakone:tokyo')?.segments ?? []).some(t => sameService(s, t)));
  if (final && outbound && moved.length) outbound.segments = outbound.segments!.filter(s => !moved.includes(s)).map((s, ord) => ({ ...s, ord }));

  for (const source of supplied.transportBookings ?? []) {
    let sourceId: string | undefined;
    let journeyKey: string | undefined;
    if (source.sourceType === 'leg') {
      sourceId = legMap.get(source.sourceId!);
      if (!sourceId) continue;
      const leg = data.legs.find(l => l.id === sourceId)!;
      journeyKey = `leg:${leg.fromStop}:${leg.toStop}`;
    } else if (source.sourceType === 'flight') {
      if (!final) continue;
      sourceId = data.flights.find(f => f.direction === 'out' && f.airport === 'NRT')?.id;
      if (!sourceId) continue;
      journeyKey = `flight:${sourceId}`;
    }
    const existing: TransportBooking | undefined = data.transportBookings.find(b => b.kind === 'journey' && (b.journeyKey === journeyKey ||
      (b.sourceType === source.sourceType && b.sourceId === sourceId) || (b.routeKey === source.routeKey && b.travelDate === source.travelDate)));
    const merged: TransportBooking = { ...clone(source), ...existing, id: existing?.id ?? uniqueId(source.id, data.transportBookings),
      journeyKey, sourceId, sourceType: source.sourceType, routeKey: source.routeKey, travelDate: source.travelDate };
    // Actual booked services establish purchase and passenger facts. Unbooked suggestions retain user decisions.
    if (source.segments?.some(s => s.status === 'booked')) {
      merged.adults = source.adults;
      merged.purchased = true;
      merged.seatReserved = source.seatReserved;
    }
    const services: TransportSegment[] = clone(existing?.segments ?? []);
    if (source.routeKey === 'hakone:tokyo') for (const s of moved) if (!services.some(t => sameService(s, t))) services.push(clone(s));
    for (const suppliedService of source.segments ?? []) {
      const index = services.findIndex(s => sameService(s, suppliedService));
      if (index < 0) services.push(clone(suppliedService));
      else if (suppliedService.status !== 'booked') services[index] = { ...clone(suppliedService), ...services[index] };
      else {
        const savedService = services[index];
        services[index] = { ...savedService, ...clone(suppliedService), id: savedService.id };
        if (savedService.seatDetails && suppliedService.seatDetails && savedService.seatDetails !== suppliedService.seatDetails) {
          const details = savedService.seatDetails.includes(suppliedService.seatDetails) ? savedService.seatDetails : `${suppliedService.seatDetails} · ${savedService.seatDetails}`;
          services[index].seatDetails = details.length <= 120 ? details : savedService.seatDetails;
        }
      }
    }
    const orderedServices = (source.segments ?? []).map(s => services.find(t => sameService(s, t))!).filter(Boolean);
    merged.segments = [...orderedServices, ...services.filter(s => !orderedServices.includes(s))].map((s, ord) => ({ ...s, ord }));
    if (existing) Object.assign(existing, merged); else data.transportBookings.push(merged);
  }
  return data;
}
