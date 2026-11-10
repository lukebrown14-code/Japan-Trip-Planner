import type { Leg, TransportBooking, TransportPlan, TransportSegment, TripData } from '@shared/types';
import { buildJourneys, journeyBooking, journeysChronological, journeySegments, passCoversJourney, type Journey } from './planner';
import { PASSES } from './catalogue';

/** Coarse per-journey state for the journey list pill. Changed plans are flagged separately by `needsReview`. */
export type JourneyStatus = 'booked' | 'partial' | 'to_book';

/** Per-journey progress for the journey list. Saved segments are authoritative when present. */
export interface JourneyProgress {
  status: JourneyStatus; ready: boolean; needsReview: boolean; nextAction: string;
  purchased: boolean; seatReserved: boolean; needsSeat: boolean;
  /** Segment counts; all zero until travellers save segments on the booking. */
  segmentsTotal: number; segmentsBooked: number; segmentsRemaining: number;
}
type Arrangement = Omit<JourneyProgress, 'ready' | 'needsReview' | 'nextAction'> & { bookAction: string };

export function journeyProgress(data: TripData, journey: Journey): JourneyProgress {
  const booking = journeyBooking(data, journey);
  const segments = journeySegments(data, journey);
  const leg = journey.sourceType === 'leg' ? data.legs.find(l => l.id === journey.sourceId) : undefined;
  const settings = data.transportPlans?.find(p => p.id === 'transport');
  const confirmed = !!booking && (booking.purchased || booking.seatReserved || booking.payOnDay) || leg?.status === 'booked'
    || segments.some(s => s.status !== 'to_book');
  const groupChanged = confirmed && (booking?.adults ?? 2) !== (settings?.adults ?? 2);
  const needsReview = groupChanged || !journey.date || !!booking && (booking.travelDate !== journey.date || booking.routeKey !== journey.routeKey
    || !!booking.selectedOption && !journey.options.some(o => o.id === booking.selectedOption));
  const { bookAction, ...arrangement } = Array.isArray(booking?.segments) ? segmentArrangement(segments) : legacyArrangement(data, journey, booking, leg, settings);
  const nextAction = !journey.date ? 'Confirm travel date' : groupChanged ? 'Review traveller count' : needsReview ? 'Review changed journey'
    : !arrangement.purchased ? bookAction : arrangement.needsSeat && !arrangement.seatReserved ? 'Reserve seats' : 'Ready to travel';
  return { ...arrangement, ready: arrangement.status === 'booked' && !needsReview, needsReview, nextAction };
}

/** Saved segments are authoritative: 'booked' and pay-on-the-day ('na') segments are arranged; only 'to_book' remains. */
function segmentArrangement(segments: TransportSegment[]): Arrangement {
  const remaining = segments.filter(s => s.status === 'to_book').length;
  const done = segments.length > 0 && remaining === 0;
  return { status: done ? 'booked' : remaining < segments.length ? 'partial' : 'to_book', purchased: done, seatReserved: done, needsSeat: false,
    segmentsTotal: segments.length, segmentsBooked: segments.length - remaining, segmentsRemaining: remaining,
    bookAction: segments.length ? `Book ${remaining} remaining segment${remaining === 1 ? '' : 's'}` : 'Add services and booking details' };
}

/** Without segments: the leg status, ticket, seat-reservation and pay-on-the-day flags. Pay on the day only covers routes with no reservation. */
function legacyArrangement(data: TripData, journey: Journey, booking: TransportBooking | undefined, leg: Leg | undefined, settings: TransportPlan | undefined): Arrangement {
  const option = journey.options.find(o => o.id === booking?.selectedOption) ?? journey.options[0];
  const adults = settings?.adults ?? 2;
  // Pass planning UI is gone, but an existing purchased pass still supplies legacy fare coverage while it covers this journey.
  const eligibility = settings?.eligibilityConfirmed === true;
  const passPurchased = (data.transportBookings ?? []).some(b => b.kind === 'pass' && b.purchased
    && (b.adults ?? 2) === adults && !!b.passId && (PASSES.find(p => p.id === b.passId)?.requiresEligibility === false || eligibility) && !!b.activationDate && passCoversJourney(b.passId, journey, b.activationDate, booking?.selectedOption));
  const purchased = !!(leg?.status === 'booked' || leg?.status === 'na' && option?.reservation === 'none'
    || !leg && booking?.purchased || booking?.payOnDay && option?.reservation === 'none' || passPurchased);
  const needsSeat = option?.reservation === 'required' || option?.reservation === 'recommended';
  const seatReserved = !!booking?.seatReserved;
  return { status: purchased && (!needsSeat || seatReserved) ? 'booked' : purchased || seatReserved ? 'partial' : 'to_book',
    purchased, seatReserved, needsSeat, segmentsTotal: 0, segmentsBooked: 0, segmentsRemaining: 0, bookAction: 'Buy ticket' };
}

export interface TransportTask {
  key: string; title: string; date?: string; ready: boolean; kind: 'journey' | 'pass';
  needsReview: boolean; nextAction: string; journey?: Journey;
}

/** User-facing actions shared by the intercity workspace and booking board. */
export function journeyNextAction(progress: JourneyProgress, legacy = progress.segmentsTotal === 0): string {
  if (progress.needsReview) return progress.nextAction;
  if ((legacy || !progress.segmentsTotal) && !progress.ready) return 'Add services and booking details';
  if (progress.segmentsRemaining) return `${progress.segmentsRemaining} service${progress.segmentsRemaining === 1 ? '' : 's'} left to book`;
  return 'Transport arranged';
}

export function intercityOrphanBookings(data: TripData): TransportBooking[] {
  const seen = new Set(buildJourneys(data).map(j => j.key));
  return (data.transportBookings ?? []).filter(b => b.kind === 'journey'
    && b.sourceType !== 'flight' && b.sourceType !== 'activity'
    && !b.journeyKey?.startsWith('flight:') && !b.journeyKey?.startsWith('activity:')
    && (!b.journeyKey || !seen.has(b.journeyKey)));
}

export function transportTasks(data: TripData): TransportTask[] {
  const journeys = journeysChronological(data).filter(j => j.type === 'intercity');
  const tasks: TransportTask[] = journeys.map(j => {
    const progress = journeyProgress(data, j);
    return { key: 'transport-' + j.key, title: j.title, date: j.date, kind: 'journey', journey: j,
      ...progress, nextAction: journeyNextAction(progress) };
  });
  // Keep airport/day-trip/pass rows in storage, without making them intercity tasks.
  for (const b of intercityOrphanBookings(data)) tasks.push(orphanTask(b));
  return tasks;
}

function orphanTask(b: TransportBooking): TransportTask {
  return { key: 'transport-orphan-' + b.id, title: 'Transport booking needs review', date: b.travelDate,
    kind: 'journey', ready: false, needsReview: true, nextAction: 'Review removed or changed journey' };
}
