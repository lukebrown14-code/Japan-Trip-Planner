import { describe, it, expect } from 'vitest';
import { SEED as BASE, SEED } from './data/seed';
import { stateAt, totalHours, segments, stopArrivals, formatHours, dayTripWindow } from './timeline';
import { toWorld } from './geo';
import { CITIES } from './data/cities';

const H = (day: number, h: number) => day * 24 + h; // day 0 = 24 Oct
const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const [x1, z1] = toWorld(a.lat, a.lng), [x2, z2] = toWorld(b.lat, b.lng); return Math.hypot(x2 - x1, z2 - z1) * 11.1; // ~km
};
const close = (s: { lat: number; lng: number }, key: string, km = 6) => expect(dist(s, CITIES[key])).toBeLessThan(km);

describe('timeline', () => {
  it('total hours', () => expect(totalHours(SEED)).toBe(13 * 24));
  it('formats readout', () => { expect(formatHours(SEED, 14)).toBe('Sat 24 Oct · 14:00'); expect(formatHours(SEED, H(12, 11.5))).toBe('Thu 5 Nov · 11:30'); });
  it('flight in: plane then airport then train to Tokyo', () => {
    expect(stateAt(SEED, 6).vehicle).toBe('plane');
    const landed = stateAt(SEED, 8.5); expect(landed.vehicle).toBe('parked'); expect(landed.stopId).toBeNull();
    expect(stateAt(SEED, 9.2).vehicle).toBe('train');
    const t = stateAt(SEED, 12); expect(t.vehicle).toBe('parked'); expect(t.stopId).toBe('s0'); close(t, 'tokyo');
  });
  it('parks during stays', () => {
    for (const [h, id, key] of [[H(1, 12), 's0', 'tokyo'], [H(3, 20), 's1', 'nikko'], [H(5, 20), 's2', 'takayama'], [H(8, 9), 's3', 'kyoto'], [H(10, 22), 's4', 'osaka'], [H(11, 20), 's5', 'hakone']] as const) {
      const s = stateAt(SEED, h); expect(s.vehicle).toBe('parked'); expect(s.stopId).toBe(id); close(s, key, 1);
    }
  });
  it('Nikko -> Takayama switches vehicles through omiya/nagano/toyama', () => {
    const veh = new Set<string>(); let minOmiya = 1e9, minNagano = 1e9, minToyama = 1e9;
    const pts = { omiya: [35.906, 139.624], nagano: [36.643, 138.188], toyama: [36.701, 137.213] };
    for (let h = H(5, 9); h <= H(5, 13); h += 0.01) {
      const s = stateAt(SEED, h); expect(s.legId).toBe('l1'); veh.add(s.vehicle);
      minOmiya = Math.min(minOmiya, dist(s, { lat: pts.omiya[0], lng: pts.omiya[1] }));
      minNagano = Math.min(minNagano, dist(s, { lat: pts.nagano[0], lng: pts.nagano[1] }));
      minToyama = Math.min(minToyama, dist(s, { lat: pts.toyama[0], lng: pts.toyama[1] }));
    }
    expect([...veh].sort()).toEqual(['limited_express', 'shinkansen', 'train']);
    expect(Math.max(minOmiya, minNagano, minToyama)).toBeLessThan(5);
  });
  it('day trip goes out and back on its day', () => {
    const SEED = { ...BASE, activities: [
      { id: 'd1', stopId: 's2', kind: 'day_trip' as const, title: 'Shirakawa-go day trip', status: 'idea' as const, destName: 'Shirakawa-go', destLat: 36.257, destLng: 136.906, mode: 'bus' as const, day: '2026-10-30' },
      { id: 'd2', stopId: 's3', kind: 'day_trip' as const, title: 'Nara day trip', status: 'idea' as const, destName: 'Nara', destLat: 34.685, destLng: 135.805, mode: 'train' as const, day: '2026-11-01' },
    ] };
    const w = dayTripWindow(SEED, 'd1')!; expect(w.t0).toBe(H(6, 10)); expect(w.t1).toBe(H(6, 17));
    const mid = stateAt(SEED, H(6, 13.5)); expect(mid.dayTripId).toBe('d1'); expect(mid.stopId).toBe('s2'); expect(dist(mid, { lat: 36.257, lng: 136.906 })).toBeLessThan(3);
    const out = stateAt(SEED, H(6, 11)); expect(out.vehicle).toBe('bus'); expect(out.dayTripId).toBe('d1');
    const back = stateAt(SEED, H(6, 17.5)); expect(back.dayTripId).toBeNull(); expect(back.vehicle).toBe('parked'); close(back, 'takayama', 1);
    expect(stateAt(SEED, H(6, 9)).dayTripId).toBeNull();
    expect(stateAt(SEED, H(8, 12)).dayTripId).toBe('d2'); // Nara by train
  });
  it('flight out: train to NRT then plane departs', () => {
    expect(stateAt(SEED, H(12, 7.5)).vehicle).not.toBe('plane');
    const ap = stateAt(SEED, H(12, 15)); expect(ap.vehicle).toBe('parked'); expect(dist(ap, { lat: 35.772, lng: 140.393 })).toBeLessThan(2);
    expect(stateAt(SEED, H(12, 18)).vehicle).toBe('plane');
  });
  it('arrivals in order', () => { const a = stopArrivals(SEED); expect(a.map(x => x.stopId)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5']); expect(a[1].hours).toBeCloseTo(H(3, 11 + 22 / 60), 5); });
  it('continuity: no teleporting', () => {
    let prev = stateAt(SEED, 0); const dt = 0.02;
    for (let h = dt; h <= totalHours(SEED); h += dt) {
      const s = stateAt(SEED, h); const k = dist(prev, s); const lim = s.vehicle === 'plane' || prev.vehicle === 'plane' ? 40 : 12;
      expect(k, `jump ${k.toFixed(1)}km at h=${h.toFixed(2)}`).toBeLessThan(lim); prev = s;
    }
  });
  it('covers all pieces monotonic', () => { const p = segments(SEED); for (let i = 1; i < p.length; i++) expect(p[i].t0).toBeGreaterThanOrEqual(p[i - 1].t1 - 1e-9); });
});
