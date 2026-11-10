import { describe, expect, it } from 'vitest';
import type { Activity, Stop } from '@shared/types';
import { SEED } from './data/seed';
import { activitiesDisplacedByBoundary, activitiesDisplacedByStops, allocateNights, dateAtFraction, dayLabel, monthGrid, moveBoundary, nightsOf, scheduleIssues, slotCentre, stopsForDay, tripDayCount } from './planner';

const stops = [...SEED.stops].sort((a, b) => a.ord - b.ord);
const trip = SEED.trip;

describe('planner geometry', () => {
  it('counts 13 days for 24 Oct – 5 Nov and 12 nights', () => {
    expect(tripDayCount(trip)).toBe(13);
    expect(stops.reduce((n, s) => n + nightsOf(s.arrive, s.depart), 0)).toBe(12);
  });
  it('slot centres round-trip through dateAtFraction', () => {
    for (const s of stops) expect(dateAtFraction(trip, slotCentre(trip, s.arrive))).toBe(s.arrive);
  });
  it('clamps positions to the trip', () => {
    expect(dateAtFraction(trip, -1)).toBe('2026-10-24');
    expect(dateAtFraction(trip, 2)).toBe('2026-11-05');
  });
});

describe('dayLabel', () => {
  it('labels the trip days', () => {
    expect(dayLabel(trip, 0)).toEqual({ weekday: 'Sat', day: 24, hol: false });
    expect(dayLabel(trip, 1).hol).toBe(true);  // Sun 25 Oct
    expect(dayLabel(trip, 10).hol).toBe(true); // Tue 3 Nov (Culture Day)
    expect(dayLabel(trip, 12)).toMatchObject({ weekday: 'Thu', day: 5 });
  });
});

describe('moveBoundary', () => {
  it('moves both sides of a boundary together', () => {
    const r = moveBoundary(stops, 0, '2026-10-26')!;
    expect(r[0].depart).toBe('2026-10-26'); expect(r[1].arrive).toBe('2026-10-26');
  });
  it('keeps at least one night each side', () => {
    expect(moveBoundary(stops, 0, '2026-10-24')![0].depart).toBe('2026-10-25');  // Tokyo 24→27 can shrink to one night
    expect(moveBoundary(stops, 1, '2026-10-24')![0].depart).toBe('2026-10-28');  // Nikko 27→29 can shrink to one night
    expect(moveBoundary(stops, 4, '2026-10-24')).toBeNull();                     // Osaka is already one night
    expect(moveBoundary(stops, 1, '2026-12-01')![0].depart).toBe('2026-10-30');  // Takayama 29→31 keeps one night
    expect(moveBoundary(stops, 2, '2026-12-01')![0].depart).toBe('2026-11-02');  // Kyoto 31 Oct→3 Nov keeps one night
  });
  it('returns null for no-ops and out-of-range indices', () => {
    expect(moveBoundary(stops, 0, stops[0].depart)).toBeNull();
    expect(moveBoundary(stops, stops.length - 1, '2026-11-01')).toBeNull();
  });
});

describe('allocateNights', () => {
  it('builds contiguous dates from city nights and preserves every other stop field', () => {
    const result = allocateNights(trip, stops, [2, 1, 2, 4, 2, 1, 0])!;
    expect(result.map(s => [s.arrive, s.depart])).toEqual([
      ['2026-10-24', '2026-10-26'], ['2026-10-26', '2026-10-27'],
      ['2026-10-27', '2026-10-29'], ['2026-10-29', '2026-11-02'],
      ['2026-11-02', '2026-11-04'], ['2026-11-04', '2026-11-05'],
      ['2026-11-05', '2026-11-05'],
    ]);
    expect(result.map(({ arrive: _arrive, depart: _depart, ...other }) => other))
      .toEqual(stops.map(({ arrive: _arrive, depart: _depart, ...other }) => other));
    expect(result[0].arrive).toBe(trip.startDate);
    expect(result.at(-1)?.depart).toBe(trip.endDate);
    expect(result.slice(1).every((s, i) => s.arrive === result[i].depart)).toBe(true);
    expect(stops[0].depart).toBe('2026-10-27');
  });

  it('rejects missing, fractional, zero, negative and wrong-total nights', () => {
    expect(allocateNights(trip, stops, [3, 1, 2, 3, 2])).toBeNull();
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(allocateNights(trip, stops, [3, bad, 2, 3, 2, 2 - bad, 0])).toBeNull();
    }
    expect(allocateNights(trip, stops, [3, 1, 2, 3, 2, 2, 0])).toBeNull();
    expect(allocateNights({ startDate: '2026-10-24', endDate: '2026-10-29' }, stops, [1, 1, 1, 1, 1, 0])).toBeNull();
  });

  it('crosses months and years without timezone-dependent dates', () => {
    const two = allocateNights({ startDate: '2026-12-30', endDate: '2027-01-03' }, stops.slice(0, 2), [2, 2])!;
    expect(two.map(s => [s.arrive, s.depart])).toEqual([
      ['2026-12-30', '2027-01-01'], ['2027-01-01', '2027-01-03'],
    ]);
  });
});

describe('activitiesDisplacedByBoundary', () => {
  const activity = (id: string, stopId: string, day?: string): Activity =>
    ({ id, stopId, day, title: `Activity ${id}`, kind: 'activity', status: 'planned' });

  it('reports scheduled activities displaced from either side of a boundary', () => {
    const before: [Stop, Stop] = [stops[2], stops[3]];
    const later = moveBoundary(stops, 2, '2026-11-01')!;
    const affected = activitiesDisplacedByBoundary([
      activity('old-kyoto', stops[3].id, '2026-10-31'),
      activity('kept-kyoto', stops[3].id, '2026-11-01'),
      activity('idea', stops[3].id),
      activity('unrelated', stops[0].id, '2026-10-31'),
    ], before, later);
    expect(affected).toEqual([{ activityId: 'old-kyoto', title: 'Activity old-kyoto', day: '2026-10-31',
      stopId: stops[3].id, stopName: stops[3].name, arrive: '2026-11-01', depart: stops[3].depart }]);

    const earlier = moveBoundary(stops, 2, '2026-10-30')!;
    expect(activitiesDisplacedByBoundary([activity('old-takayama', stops[2].id, '2026-10-31')], before, earlier))
      .toMatchObject([{ activityId: 'old-takayama', stopName: stops[2].name }]);
  });

  it('does not flag changeover days or activities already outside their original stay', () => {
    const before: [Stop, Stop] = [stops[2], stops[3]];
    const later = moveBoundary(stops, 2, '2026-11-01')!;
    expect(activitiesDisplacedByBoundary([
      activity('changeover', stops[2].id, '2026-11-01'),
      activity('pre-existing', stops[3].id, '2026-10-29'),
    ], before, later)).toEqual([]);
  });
});

describe('activitiesDisplacedByStops', () => {
  it('reports newly displaced activities across multiple changed cities', () => {
    const after = allocateNights(trip, stops, [2, 1, 2, 4, 2, 1, 0])!;
    const activity = (id: string, stopId: string, day?: string): Activity =>
      ({ id, stopId, day, title: id, kind: 'activity', status: 'planned' });
    const displaced = activitiesDisplacedByStops([
      activity('tokyo', stops[0].id, '2026-10-27'),
      activity('nikko', stops[1].id, '2026-10-28'),
      activity('takayama', stops[2].id, '2026-10-30'),
      activity('changeover', stops[3].id, '2026-10-30'),
      activity('preexisting', stops[0].id, '2026-11-01'),
      activity('undated', stops[0].id),
      activity('unknown', 'missing', '2026-10-30'),
    ], stops, after);
    expect(displaced.map(a => a.activityId)).toEqual(['tokyo', 'nikko', 'takayama']);
    expect(displaced.map(a => [a.arrive, a.depart])).toEqual(after.slice(0, 3).map(s => [s.arrive, s.depart]));
  });
});

describe('monthGrid', () => {
  const months = monthGrid(trip);
  it('covers Oct and Nov 2026 in Monday-first weeks', () => {
    expect(months.map(m => m.key)).toEqual(['2026-10', '2026-11']);
    expect(months.every(m => m.weeks.every(w => w.length === 7))).toBe(true);
    expect(months[0].weeks[0].indexOf('2026-10-01')).toBe(3); // Thu
    expect(months[1].weeks[0][6]).toBe('2026-11-01');         // Sun
  });
  it('contains every date exactly once', () => {
    expect(months[0].weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(months[1].weeks.flat().filter(Boolean)).toHaveLength(30);
  });
  it('rolls over a year boundary', () => {
    expect(monthGrid({ startDate: '2026-12-30', endDate: '2027-01-02' }).map(m => m.key)).toEqual(['2026-12', '2027-01']);
  });
});

describe('stopsForDay', () => {
  it('returns one stop mid-stay and both on a changeover day', () => {
    expect(stopsForDay(stops, '2026-10-25').map(s => s.name)).toEqual([stops[0].name]);
    expect(stopsForDay(stops, stops[0].depart).map(s => s.id)).toEqual([stops[0].id, stops[1].id]);
    expect(stopsForDay(stops, '2026-12-01')).toEqual([]);
  });
});

describe('scheduleIssues', () => {
  it('is clean for the seed', () => expect(scheduleIssues(trip, stops)).toEqual([]));
  it('flags gaps, overlaps and out-of-range stays', () => {
    const bad: Stop[] = stops.map((s, i) => i === 1 ? { ...s, arrive: '2026-10-28' } : i === 2 ? { ...s, arrive: '2026-10-27' } : s);
    expect(scheduleIssues(trip, bad).map(x => x.kind)).toEqual(['gap', 'overlap']);
    expect(scheduleIssues({ ...trip, endDate: '2026-11-04' }, stops).some(x => x.kind === 'range')).toBe(true);
  });
});
