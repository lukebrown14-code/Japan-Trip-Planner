import { describe, expect, it } from 'vitest';
import { SEED } from '../data/seed';
import { dayPlan, japanClock, nextItem } from './dayPlan';

describe('Today daily plan', () => {
  it('uses the Japan date and time across UTC midnight', () => {
    expect(japanClock(new Date('2026-10-26T15:05:00Z'))).toEqual({ date: '2026-10-27', minutes: 5 });
  });
  it('shows the incoming journey and destination hotel on a transfer day', () => {
    const p = dayPlan(SEED, '2026-10-27');
    expect(p.stop?.name).toBe('Nikko');
    expect(p.items.map(i => i.title)).toEqual(['Tokyo → Nikko']);
  });
  it('includes activities in both cities and sorts them around travel', () => {
    const data = { ...SEED, activities: [
      { id: 'a', stopId: 's0', title: 'Breakfast', kind: 'activity' as const, status: 'planned' as const, day: '2026-10-27', time: '08:00' },
      { id: 'b', stopId: 's1', title: 'Temple', kind: 'activity' as const, status: 'booked' as const, day: '2026-10-27', time: '15:00' },
      { id: 'c', stopId: 's1', title: 'Explore', kind: 'activity' as const, status: 'planned' as const, day: '2026-10-27' },
    ] };
    const { items } = dayPlan(data, '2026-10-27');
    expect(items.map(i => i.title)).toEqual(['Breakfast', 'Tokyo → Nikko', 'Temple', 'Explore']);
    expect(nextItem(items, 11 * 60, true)?.kind).toBe('travel');
    expect(nextItem(items, 14 * 60, true)?.title).toBe('Temple');
    expect(nextItem(items, 17 * 60, true)?.title).toBe('Explore');
  });
  it('does not repeat past appointments or promote ideas as Up next', () => {
    const data = { ...SEED, activities: [{ id: 'a', stopId: 's0', title: 'Maybe', kind: 'activity' as const, status: 'idea' as const, day: '2026-10-25', time: '15:00' }] };
    expect(nextItem(dayPlan(data, '2026-10-25').items, 0, true)).toBeUndefined();
    expect(nextItem(dayPlan(SEED, '2026-10-27').items, 15 * 60, true)).toBeUndefined();
  });
  it('only shows flights on their date', () => {
    expect(dayPlan(SEED, '2026-10-24').items[0].kind).toBe('flight');
    expect(dayPlan(SEED, '2026-11-04').items.some(i => i.kind === 'flight')).toBe(false);
    expect(dayPlan(SEED, '2026-11-05').items[0].kind).toBe('flight');
  });
  it('does not invent times for an unconfigured transfer', () => {
    const { items } = dayPlan({ ...SEED, legs: [], transportBookings: [] }, '2026-10-27');
    expect(items[0].minutes).toBeNull();
  });
  it('keeps overnight travel visible the following morning', () => {
    const data = { ...SEED, transportBookings: [], legs: SEED.legs.map((l, i) => i === 0 ? { ...l, departTime: '23:00', arriveTime: '02:00' } : l) };
    const { items } = dayPlan(data, '2026-10-28');
    expect(items[0].kind).toBe('travel');
    expect(nextItem(items, 60, true)?.title).toBe('Tokyo → Nikko');
  });
  it('prefers saved service times over legacy leg times', () => {
    const data = { ...SEED, legs: SEED.legs.map(l => ({ ...l, departTime: '01:00', arriveTime: '02:00' })) };
    const travel = dayPlan(data, '2026-10-27').items.find(i => i.kind === 'travel');
    expect(travel?.time).toBe('09:30');
    expect(travel?.kind === 'travel' && travel.journey.legacy).toBe(false);
  });
  it('keeps saved overnight services visible across explicit day offsets', () => {
    const data = { ...SEED, transportBookings: SEED.transportBookings?.map(b => b.journeyKey === 'leg:s0:s1' ? {
      ...b, segments: [{ id: 'night', ord: 0, service: 'Night train', fromStation: 'Tokyo', toStation: 'Nikko', status: 'booked' as const,
        departTime: '23:00', arriveTime: '02:00', departDayOffset: 0, arriveDayOffset: 1 }],
    } : b) };
    const items = dayPlan(data, '2026-10-28').items;
    expect(nextItem(items, 60, true)?.title).toBe('Tokyo → Nikko');
    expect(nextItem(items, 180, true)).toBeUndefined();
  });
  it('does not fall back to legacy times when saved services lack times', () => {
    const data = { ...SEED, transportBookings: SEED.transportBookings?.map(b => b.journeyKey === 'leg:s0:s1' ? {
      ...b, segments: [{ id: 'unknown', ord: 0, service: 'Train', fromStation: 'Tokyo', toStation: 'Nikko', status: 'to_book' as const }],
    } : b) };
    const travel = dayPlan(data, '2026-10-27').items.find(i => i.kind === 'travel');
    expect(travel?.minutes).toBeNull();
    expect(travel?.endMinutes).toBeNull();
  });
  it('handles an empty trip', () => {
    expect(dayPlan({ ...SEED, stops: [], activities: [], flights: [] }, '2026-10-24')).toEqual({ stop: undefined, items: [] });
  });
});
