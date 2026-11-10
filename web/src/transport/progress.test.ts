import { describe, expect, it } from 'vitest';
import type { BookStatus, TransportBooking, TransportSegment, TripData } from '@shared/types';
import { journeyProgress, transportTasks } from './progress';
import { buildJourneys, journeysChronological, type Journey } from './planner';
import { SEED } from '../data/seed';

const fixture = (): TripData => structuredClone(SEED);
const seg = (status: TransportSegment['status'], ord = 1): TransportSegment => ({ id: `seg-${ord}`, ord, status });
const segments = (...statuses: TransportSegment['status'][]): TransportSegment[] => statuses.map((status, i) => seg(status, i + 1));
const bookingFor = (journeyKey: string, extra: Partial<TransportBooking> = {}): TransportBooking =>
  ({ id: 'test', kind: 'journey', journeyKey, purchased: false, seatReserved: false, ...extra });

describe('transport booking progress', () => {
  it('keeps ticket purchase separate from seat reservations', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.sourceType === 'leg' && j.options.some(o => o.reservation !== 'none'))!;
    expect(journey).toBeDefined();
    const option = journey.options.find(o => o.reservation !== 'none')!;
    data.legs.find(l => l.id === journey.sourceId)!.status = 'booked';
    data.transportBookings = [{ id: 'test', kind: 'journey', journeyKey: journey.key, purchased: false, seatReserved: false,
      travelDate: journey.date, routeKey: journey.routeKey, selectedOption: option.id }];
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: true, ready: false, nextAction: 'Reserve seats' });
    data.transportBookings[0].seatReserved = true;
    expect(journeyProgress(data, journey).ready).toBe(true);
  });
  it('pass coverage needs eligibility and never supplies a seat reservation', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.sourceType === 'leg' && j.options.some(o => o.fullyCoveredBy?.includes('jr')))!;
    const option = journey.options.find(o => o.fullyCoveredBy?.includes('jr'))!;
    data.transportPlans = [{ id: 'transport', adults: 2, eligibilityConfirmed: false }];
    data.transportBookings = [
      { id: 'pass', kind: 'pass', passId: 'jr-7', activationDate: journey.date, purchased: true, seatReserved: false },
      { id: 'journey', kind: 'journey', journeyKey: journey.key, travelDate: journey.date, routeKey: journey.routeKey,
        selectedOption: option.id, purchased: false, seatReserved: false },
    ];
    expect(journeyProgress(data, journey).purchased).toBe(false);
    data.transportPlans[0].eligibilityConfirmed = true;
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: true, seatReserved: false, ready: false });
    data.transportBookings[1].seatReserved = true;
    expect(journeyProgress(data, journey).ready).toBe(true);
  });
  it('preserves a purchased booking but flags changed travel dates', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.sourceType === 'leg')!;
    data.legs.find(l => l.id === journey.sourceId)!.status = 'booked';
    data.transportBookings = [{ id: 'test', kind: 'journey', journeyKey: journey.key, purchased: true, seatReserved: true,
      travelDate: '2000-01-01', routeKey: journey.routeKey }];
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: true, needsReview: true, ready: false });
  });
  it('does not infer transport purchase from flight or activity bookings', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.sourceType === 'flight')!;
    expect(journey).toBeDefined();
    data.flights.forEach(f => f.status = 'booked');
    expect(journeyProgress(data, journey).purchased).toBe(false);
  });
  it('a purchased airport transfer without a travel date is not ready', () => {
    const data = fixture();
    data.flights.find(f => f.direction === 'in')!.arriveAt = undefined;
    const journey = buildJourneys(data).find(j => j.sourceType === 'flight' && j.sourceId === 'f1')!;
    data.transportBookings = [{ id: 'airport', kind: 'journey', journeyKey: journey.key, purchased: true, seatReserved: true,
      travelDate: journey.date, routeKey: journey.routeKey }];
    expect(journeyProgress(data, journey)).toMatchObject({ ready: false, needsReview: true, nextAction: 'Confirm travel date' });
  });
  it('changed traveller numbers preserve confirmations but require review', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.sourceType === 'leg')!;
    data.legs.find(l => l.id === journey.sourceId)!.status = 'booked';
    data.transportPlans = [{ id: 'transport', adults: 3, eligibilityConfirmed: true }];
    data.transportBookings = [{ id: 'test', kind: 'journey', journeyKey: journey.key, purchased: true, seatReserved: true,
      adults: 2, confirmation: 'KEEP', travelDate: journey.date, routeKey: journey.routeKey },
      { id: 'pass', kind: 'pass', passId: 'jr-7', activationDate: journey.date, purchased: true, seatReserved: false, adults: 2 }];
    expect(journeyProgress(data, journey)).toMatchObject({ ready: false, needsReview: true, nextAction: 'Review traveller count' });
    expect(data.transportBookings[0].confirmation).toBe('KEEP');
  });
  it('legacy booked legs require group review when traveller numbers change', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.routeKey === 'kyoto:osaka')!;
    data.legs.find(l => l.id === journey.sourceId)!.status = 'booked';
    data.transportPlans = [{ id: 'transport', adults: 3, eligibilityConfirmed: false }];
    data.transportBookings = [];
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: true, ready: false, needsReview: true, nextAction: 'Review traveller count' });
  });
  it('ordinary train pay-on-the-day preparation never covers reserved-route tickets', () => {
    const data = fixture();
    const journey = buildJourneys(data).find(j => j.routeKey === 'kyoto:osaka')!;
    data.transportBookings = [{ id: 'test', kind: 'journey', journeyKey: journey.key, purchased: false, seatReserved: false,
      payOnDay: true, travelDate: journey.date, routeKey: journey.routeKey }];
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: true, ready: true });
    const reserved = { ...journey, options: journey.options.map(o => ({ ...o, reservation: 'required' as const })) };
    expect(journeyProgress(data, reserved)).toMatchObject({ purchased: false, ready: false });
    data.legs.find(l => l.id === journey.sourceId)!.status = 'na';
    expect(journeyProgress(data, reserved).purchased).toBe(false);
    expect(journeyProgress(data, journey).ready).toBe(true);
  });
});

describe('segment-aware journey progress', () => {
  it('saved segments drive booked counts and next actions', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.sourceType === 'leg')!;
    data.transportBookings = [bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, segments: segments('booked', 'to_book') })];
    expect(journeyProgress(data, journey)).toMatchObject({ segmentsTotal: 2, segmentsBooked: 1, segmentsRemaining: 1,
      purchased: false, ready: false, nextAction: 'Book 1 remaining segment' });
    data.transportBookings[0].segments = segments('booked', 'booked');
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: true, ready: true, nextAction: 'Ready to travel' });
    data.transportBookings[0].segments = segments('to_book', 'to_book', 'to_book');
    expect(journeyProgress(data, journey).nextAction).toBe('Book 3 remaining segments');
  });
  it('pay-on-the-day segments need no further booking', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.sourceType === 'leg')!;
    data.transportBookings = [bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, segments: segments('na') })];
    expect(journeyProgress(data, journey)).toMatchObject({ segmentsRemaining: 0, purchased: true, ready: true, nextAction: 'Ready to travel' });
  });
  it('segments take precedence over legacy ticket and pass flags', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.sourceType === 'leg')!;
    data.transportPlans = [{ id: 'transport', adults: 2, eligibilityConfirmed: true }];
    data.transportBookings = [
      bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, purchased: true, seatReserved: true, segments: segments('to_book') }),
      { id: 'pass', kind: 'pass', passId: 'jr-7', activationDate: journey.date, purchased: true, seatReserved: false },
    ];
    expect(journeyProgress(data, journey)).toMatchObject({ purchased: false, ready: false, nextAction: 'Book 1 remaining segment' });
  });
  it('booked segments still surface changed dates, routes and group sizes', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.sourceType === 'leg')!;
    data.transportPlans = [{ id: 'transport', adults: 3, eligibilityConfirmed: false }];
    data.transportBookings = [bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, adults: 2, segments: segments('booked') })];
    expect(journeyProgress(data, journey)).toMatchObject({ needsReview: true, ready: false, nextAction: 'Review traveller count' });
    data.transportPlans[0].adults = 2;
    data.transportBookings[0].travelDate = '2000-01-01';
    expect(journeyProgress(data, journey)).toMatchObject({ needsReview: true, nextAction: 'Review changed journey' });
    data.transportBookings[0].travelDate = journey.date;
    expect(journeyProgress(data, journey).ready).toBe(true);
  });
  it('still gates undated journeys when segments exist', () => {
    const data = fixture();
    data.flights.find(f => f.direction === 'in')!.arriveAt = undefined;
    const journey = buildJourneys(data).find(j => j.sourceType === 'flight' && j.sourceId === 'f1')!;
    data.transportBookings = [bookingFor(journey.key, { purchased: true, seatReserved: true, segments: segments('booked') })];
    expect(journeyProgress(data, journey)).toMatchObject({ ready: false, needsReview: true, nextAction: 'Confirm travel date' });
  });
});

describe('journey status', () => {
  const status = (data: TripData, journey: Journey) => journeyProgress(data, journey).status;
  it('derives status from segments before any legacy flags', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.type === 'intercity')!;
    const withSegments = (list: TransportSegment[], extra: Partial<TransportBooking> = {}) =>
      ({ ...data, transportBookings: [bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, ...extra, segments: list })] });
    expect(status(data, journey)).toBe('booked'); // seeded Revaty segment
    expect(status(withSegments(segments('booked', 'booked')), journey)).toBe('booked');
    expect(status(withSegments(segments('booked', 'to_book')), journey)).toBe('partial');
    expect(status(withSegments(segments('to_book', 'to_book')), journey)).toBe('to_book');
    expect(status(withSegments(segments('na')), journey)).toBe('booked'); // pay on the day is already arranged
    expect(status(withSegments(segments('na', 'to_book')), journey)).toBe('partial');
    expect(status(withSegments(segments('to_book'), { purchased: true, seatReserved: true }), journey)).toBe('to_book'); // segments take precedence
    expect(status(withSegments([]), journey)).toBe('to_book'); // an empty list falls back to the legacy flags
  });
  it('applies the same legacy ticket, seat and pay-on-the-day rules as progress', () => {
    const data: TripData = { ...fixture(), transportBookings: [] };
    const journeys = journeysChronological(data);
    const reserved = journeys.find(j => j.routeKey === 'tokyo:nikko')!; // limited express: seats required
    const local = journeys.find(j => j.routeKey === 'kyoto:osaka')!; // no reservation
    const airport = journeys.find(j => j.type === 'airport')!;
    const legs = (journey: Journey, legStatus: BookStatus) => data.legs.map(l => l.id === journey.sourceId ? { ...l, status: legStatus } : l);
    const saved = (journey: Journey, extra: Partial<TransportBooking>): TripData =>
      ({ ...data, transportBookings: [bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, ...extra })] });
    expect(status(data, reserved)).toBe('to_book');
    expect(status(saved(airport, { purchased: true }), airport)).toBe('booked');
    expect(status({ ...data, legs: legs(reserved, 'booked') }, reserved)).toBe('partial'); // ticket bought, seats still to reserve
    expect(status({ ...saved(reserved, { seatReserved: true }), legs: legs(reserved, 'booked') }, reserved)).toBe('booked');
    expect(status(saved(local, { payOnDay: true }), local)).toBe('booked');
    expect(status({ ...data, legs: legs(local, 'na') }, local)).toBe('booked');
    expect(status(saved(reserved, { payOnDay: true }), reserved)).toBe('to_book'); // pay on the day never covers a reserved route
    expect(status({ ...data, legs: legs(reserved, 'na') }, reserved)).toBe('to_book');
  });
  it('keeps the arrangement in the status and flags changed plans separately', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.type === 'intercity')!;
    data.transportBookings = [bookingFor(journey.key, { travelDate: '2000-01-01', routeKey: journey.routeKey, segments: segments('booked') })];
    expect(journeyProgress(data, journey)).toMatchObject({ status: 'booked', needsReview: true, ready: false, nextAction: 'Review changed journey' });
  });
});

describe('transport tasks', () => {
  it('emits one task per chronological journey, in travel order', () => {
    const data = fixture();
    const tasks = transportTasks(data);
    expect(tasks.map(t => t.key)).toEqual(journeysChronological(data).filter(j => j.type === 'intercity').map(j => 'transport-' + j.key));
    expect(tasks.every(t => t.kind === 'journey' && t.journey)).toBe(true);
  });
  it('excludes day trips and emits no tasks for pass rows, keeping their data', () => {
    const data = fixture();
    data.activities = [{ id: 'day', stopId: 's1', kind: 'day_trip', title: 'Edo Wonderland', destName: 'Nikko', day: '2026-10-27', status: 'planned' }];
    data.transportBookings = [
      { id: 'pass', kind: 'pass', passId: 'jr-7', activationDate: '2026-10-27', purchased: true, seatReserved: false },
      bookingFor('activity:day', { travelDate: '2026-10-27', purchased: true, seatReserved: false }),
    ];
    const tasks = transportTasks(data);
    expect(tasks.find(t => t.kind === 'pass')).toBeUndefined();
    expect(tasks.some(t => t.journey?.type === 'daytrip')).toBe(false);
    expect(tasks).toHaveLength(journeysChronological(data).filter(j => j.type === 'intercity').length); // day-trip booking is valid, not an orphan
    expect(data.transportBookings).toHaveLength(2); // pass and day-trip rows stay untouched
  });
  it('flows segment-aware next actions into journey tasks', () => {
    const data = fixture();
    const journey = journeysChronological(data).find(j => j.sourceType === 'leg')!;
    data.transportBookings = [bookingFor(journey.key, { travelDate: journey.date, routeKey: journey.routeKey, segments: segments('booked', 'to_book') })];
    expect(transportTasks(data).find(t => t.key === 'transport-' + journey.key))
      .toMatchObject({ kind: 'journey', ready: false, needsReview: false, nextAction: '1 service left to book' });
  });
  it('includes orphaned bookings as pending review tasks', () => {
    const data = fixture();
    data.transportBookings = [{ id: 'orphan', kind: 'journey', journeyKey: 'removed', purchased: true, seatReserved: true }];
    const tasks = transportTasks(data);
    expect(tasks.find(t => t.key === 'transport-orphan-orphan')).toMatchObject({ ready: false, needsReview: true, nextAction: 'Review removed or changed journey' });
    expect(tasks.filter(t => t.journey)).toHaveLength(journeysChronological(data).filter(j => j.type === 'intercity').length);
  });
});
