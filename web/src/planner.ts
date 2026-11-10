// Pure helpers for the static trip-planner bar: date <-> slot geometry and boundary moves. Tested in planner.test.ts.
import type { Activity, Stop, Trip } from '@shared/types';

export const CITY_COLORS = ['#ff9eb5', '#f2b134', '#ff8a5c', '#7fd1f5', '#9fdcab', '#c3a6f2', '#f5e07a'];
/** Colour of the stop at sorted position `i` (shared by the planner blocks and the city panel). */
export const cityColor = (i: number) => CITY_COLORS[Math.max(0, i) % CITY_COLORS.length];
export const sortedStops = (stops: Stop[]) => [...stops].sort((a, b) => a.ord - b.ord);
const DAY = 864e5;
export const dayNum = (iso: string) => Math.round(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / DAY);
export const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

type Range = Pick<Trip, 'startDate' | 'endDate'>;
/** Number of calendar days in the trip, inclusive of both ends (24 Oct – 5 Nov = 13). */
export const tripDayCount = (t: Range) => dayNum(t.endDate) - dayNum(t.startDate) + 1;
/** Position of a date's centre along the ruler, 0..1. Each day owns an equal slot. */
export const slotCentre = (t: Range, iso: string) => (dayNum(iso) - dayNum(t.startDate) + 0.5) / tripDayCount(t);
/** Nearest trip date to a 0..1 ruler position, clamped to the trip. */
export function dateAtFraction(t: Range, f: number) {
  const n = tripDayCount(t); const i = Math.min(n - 1, Math.max(0, Math.round(f * n - 0.5)));
  return isoOf(dayNum(t.startDate) + i);
}
export const nightsOf = (arrive: string, depart: string) => Math.max(0, dayNum(depart) - dayNum(arrive));

/** Assign nights to each sorted stop, preserving same-day visits while keeping the trip's first and last dates fixed. */
export function allocateNights(trip: Range, stops: Stop[], nights: number[]): Stop[] | null {
  const start = dayNum(trip.startDate), end = dayNum(trip.endDate);
  if (!stops.length || stops.length !== nights.length || !Number.isFinite(start) || !Number.isFinite(end) ||
      end <= start || nights.some((n, i) => !Number.isSafeInteger(n) || n < (nightsOf(stops[i].arrive, stops[i].depart) === 0 ? 0 : 1)) ||
      nights.reduce((sum, n) => sum + n, 0) !== end - start) return null;
  let day = start;
  return stops.map((stop, i) => {
    const arrive = isoOf(day);
    day += nights[i];
    return { ...stop, arrive, depart: isoOf(day) };
  });
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Ruler label for trip day `i`; `hol` marks Sundays and Culture Day (3 Nov). */
export function dayLabel(t: Pick<Trip, 'startDate'>, i: number) {
  const n = dayNum(t.startDate) + i, weekday = WD[new Date(n * DAY).getUTCDay()];
  return { weekday, day: new Date(n * DAY).getUTCDate(), hol: weekday === 'Sun' || isoOf(n).slice(5) === '11-03' };
}

/**
 * Drag the boundary between sorted stops[i] and stops[i+1] to `date`. Both the earlier stop's depart and the later stop's
 * arrive become that date, clamped so each stay keeps at least one night. Returns null if nothing changes.
 */
export function moveBoundary(stops: Stop[], i: number, date: string): [Stop, Stop] | null {
  const a = stops[i], b = stops[i + 1]; if (!a || !b) return null;
  const lo = dayNum(a.arrive) + 1, hi = dayNum(b.depart) - 1;
  if (hi < lo) return null;
  const d = isoOf(Math.min(hi, Math.max(lo, dayNum(date))));
  if (a.depart === d && b.arrive === d) return null;
  return [{ ...a, depart: d }, { ...b, arrive: d }];
}

export interface DisplacedActivity {
  activityId: string;
  title: string;
  day: string;
  stopId: string;
  stopName: string;
  arrive: string;
  depart: string;
}

/** Scheduled activities newly outside their city's dates after any number of stops change. Changeover days belong to both stops. */
export function activitiesDisplacedByStops(activities: Activity[], before: Stop[], after: Stop[]): DisplacedActivity[] {
  const oldById = new Map(before.map(stop => [stop.id, stop]));
  const newById = new Map(after.map(stop => [stop.id, stop]));
  return activities.flatMap(activity => {
    if (!activity.day) return [];
    const oldStop = oldById.get(activity.stopId), newStop = newById.get(activity.stopId);
    if (!oldStop || !newStop || activity.day < oldStop.arrive || activity.day > oldStop.depart ||
        (activity.day >= newStop.arrive && activity.day <= newStop.depart)) return [];
    return [{ activityId: activity.id, title: activity.title, day: activity.day,
      stopId: newStop.id, stopName: newStop.name, arrive: newStop.arrive, depart: newStop.depart }];
  });
}

/** Scheduled activities that a proposed boundary move would hide from their stop's daily plan. */
export function activitiesDisplacedByBoundary(activities: Activity[], before: [Stop, Stop], after: [Stop, Stop]): DisplacedActivity[] {
  return activitiesDisplacedByStops(activities, before, after);
}

/** A pointer press on the handle after sorted stop `i` that moved under TAP_SLOP px is a tap: it selects the stop on the tapped side of the handle. */
export const TAP_SLOP = 6;
export const tapStopIndex = (i: number, releaseX: number, handleCentreX: number) => (releaseX < handleCentreX ? i : i + 1);

export interface Issue { kind: 'gap' | 'overlap' | 'range'; index: number } // index = earlier stop of the pair (gap/overlap) or the stop itself (range)
/** Schedule problems between consecutive stops and against the trip range. */
export function scheduleIssues(trip: Trip, stops: Stop[]): Issue[] {
  const out: Issue[] = [];
  stops.forEach((s, i) => {
    const n = stops[i + 1];
    if (n) { const d = dayNum(n.arrive) - dayNum(s.depart); if (d > 0) out.push({ kind: 'gap', index: i }); else if (d < 0) out.push({ kind: 'overlap', index: i }); }
    if (dayNum(s.arrive) < dayNum(trip.startDate) || dayNum(s.depart) > dayNum(trip.endDate)) out.push({ kind: 'range', index: i });
  });
  return out;
}

export interface Month { key: string; label: string; weeks: (string | null)[][] } // weeks start Monday; null = padding outside the month
/** Month grids (Mon–Sun weeks) covering every month the trip touches, for the calendar view. */
export function monthGrid(t: Range): Month[] {
  const out: Month[] = [];
  const first = new Date(dayNum(t.startDate) * DAY), last = new Date(dayNum(t.endDate) * DAY);
  let y = first.getUTCFullYear(), m = first.getUTCMonth();
  while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
    const start = Date.UTC(y, m, 1) / DAY, days = Date.UTC(y, m + 1, 1) / DAY - start;
    const lead = (new Date(start * DAY).getUTCDay() + 6) % 7; // Monday = 0
    const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoOf(start + i))];
    while (cells.length % 7) cells.push(null);
    const weeks: (string | null)[][] = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: new Date(start * DAY).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }), weeks });
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

/** Stops whose stay covers `iso` (arrive and depart days included, so a changeover day returns both). */
export const stopsForDay = (stops: Stop[], iso: string) => stops.filter(s => s.arrive <= iso && iso <= s.depart);
