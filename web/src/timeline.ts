// OWNED BY: Timeline & playback agent. Pure functions: TripData + tripHours -> TimelineState. Tested in timeline.test.ts.
// Heading convention: radians, atan2(dx, dz) in geo.toWorld coords (x east, z south). A model whose forward axis is +z
// uses rotation.y = heading; a model facing +x uses rotation.y = heading - PI/2.
import type { TripData, Stop, Leg, Mode } from '@shared/types';
import { NODES, nodePos, shortestPath, type PathStep } from './data/rails';
import { CITIES, AIRPORTS } from './data/cities';
import { toWorld } from './geo';

export interface TimelineState { vehicle: 'parked' | 'shinkansen' | 'limited_express' | 'train' | 'bus' | 'plane'; lat: number; lng: number; heading: number; stopId: string | null; legId: string | null; dayTripId: string | null; hours: number }
export function totalHours(d: TripData) { return (Date.parse(d.trip.endDate) - Date.parse(d.trip.startDate)) / 36e5 + 24; }

type Veh = TimelineState['vehicle'];
type LL = [number, number];
export type PieceKind = 'flight_in' | 'airport_in' | 'transfer_in' | 'stay' | 'leg' | 'trip_out' | 'trip_stay' | 'trip_back' | 'transfer_out' | 'airport_out' | 'flight_out';
export interface Piece {
  t0: number; t1: number; kind: PieceKind; vehicle: Veh; pts: LL[];
  stopId: string | null; legId: string | null; dayTripId: string | null;
  hd: number; cum: number[]; // cum: cumulative world length at each pt
}

const DAY = 24;
const utc = (s: string) => Date.parse(s.length <= 10 ? s + 'T00:00:00Z' : s + 'Z');
const dayIdx = (d: TripData, date: string) => Math.round((utc(date.slice(0, 10)) - utc(d.trip.startDate)) / 864e5);
const hhmm = (s: string | undefined, def: number) => { if (!s) return def; const m = /^(\d{1,2}):(\d{2})/.exec(s); return m ? +m[1] + +m[2] / 60 : def; };
const isoToHours = (d: TripData, iso: string) => (utc(iso) - utc(d.trip.startDate)) / 36e5;
const ease = (u: number) => u * u * (3 - 2 * u);

export function modeVehicle(m: Mode | undefined): Veh { return m === 'walk' || !m ? 'train' : m; }
const km = (a: LL, b: LL) => {
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const wlen = (a: LL, b: LL) => { const [x1, z1] = toWorld(a[0], a[1]), [x2, z2] = toWorld(b[0], b[1]); return Math.hypot(x2 - x1, z2 - z1); };
const wheading = (a: LL, b: LL) => { const [x1, z1] = toWorld(a[0], a[1]), [x2, z2] = toWorld(b[0], b[1]); return Math.atan2(x2 - x1, z2 - z1); };

function nearestNode(p: LL, maxKm = Infinity): string | null {
  let best: string | null = null, bd = maxKm;
  for (const n of NODES) { if (n.id === 'hnd' || n.id === 'nrt') continue; const k = km(p, [n.lat, n.lng]); if (k <= bd) { bd = k; best = n.id; } }
  return best;
}
/** Rail node used for a stop: nearest station within 5 km, else the city preset's station, else nearest overall. */
export function stopNode(s: Stop): string {
  return nearestNode([s.lat, s.lng], 5) ?? CITIES[s.cityKey]?.station ?? nearestNode([s.lat, s.lng])!;
}
const airportNode = (a: 'HND' | 'NRT') => a.toLowerCase();
const airportPos = (a: 'HND' | 'NRT'): LL => [AIRPORTS[a].lat, AIRPORTS[a].lng];
const offMap = (a: 'HND' | 'NRT'): LL => { const p = airportPos(a); return [p[0] - 4.5, p[1] + 8]; };

function stepPts(st: PathStep): LL[] {
  const e = st.edge; const pts: LL[] = [nodePos(e.a), ...(e.via ?? []), nodePos(e.b)];
  return st.reversed ? pts.reverse() : pts;
}

class Builder {
  pieces: Piece[] = [];
  push(p: Omit<Piece, 'hd' | 'cum'>) {
    const cum = [0]; for (let i = 1; i < p.pts.length; i++) cum.push(cum[i - 1] + wlen(p.pts[i - 1], p.pts[i]));
    this.pieces.push({ ...p, hd: 0, cum });
  }
  parked(t0: number, t1: number, kind: PieceKind, pos: LL, stopId: string | null, dayTripId: string | null = null) {
    if (t1 <= t0) return; this.push({ t0, t1, kind, vehicle: 'parked', pts: [pos], stopId, legId: null, dayTripId });
  }
  /** Route via rail graph. If t1 is given, time is scaled to fit [t0,t1]; else real time. Returns end time. */
  route(from: string, to: string, t0: number, t1: number | null, kind: PieceKind, ids: { stopId: string | null; legId: string | null; dayTripId: string | null },
    startPos?: LL, endPos?: LL, vehOverride?: Veh): number {
    const steps = from === to ? [] : shortestPath(from, to);
    const sp = startPos ?? nodePos(from), ep = endPos ?? nodePos(to);
    if (!steps.length) {
      const end = t1 ?? t0 + Math.max(0.1, km(sp, ep) / 60);
      this.push({ t0, t1: end, kind, vehicle: vehOverride ?? 'train', pts: [sp, ep], ...ids }); return end;
    }
    const total = steps.reduce((s, x) => s + x.edge.minutes, 0);
    const span = t1 === null ? total / 60 : t1 - t0;
    let t = t0;
    steps.forEach((st, i) => {
      const dt = span * st.edge.minutes / total; const pts = stepPts(st);
      if (i === 0 && startPos) pts.unshift(startPos);
      if (i === steps.length - 1 && endPos) pts.push(endPos);
      this.push({ t0: t, t1: t + dt, kind, vehicle: vehOverride ?? modeVehicle(st.edge.mode), pts, ...ids }); t += dt;
    });
    return t0 + span;
  }
  finish() {
    const ps = this.pieces; const moving = (p: Piece) => p.vehicle !== 'parked' && p.pts.length > 1;
    const hOf = (p: Piece, end: boolean) => { // heading at start/end of a moving piece
      const n = p.pts.length; if (end) { for (let i = n - 1; i > 0; i--) if (wlen(p.pts[i - 1], p.pts[i]) > 1e-6) return wheading(p.pts[i - 1], p.pts[i]); }
      else for (let i = 1; i < n; i++) if (wlen(p.pts[i - 1], p.pts[i]) > 1e-6) return wheading(p.pts[i - 1], p.pts[i]);
      return 0;
    };
    ps.forEach((p, i) => {
      if (moving(p)) { p.hd = hOf(p, false); return; }
      let h: number | null = null;
      for (let j = i - 1; j >= 0 && h === null; j--) if (moving(ps[j])) h = hOf(ps[j], true);
      for (let j = i + 1; j < ps.length && h === null; j++) if (moving(ps[j])) h = hOf(ps[j], false);
      p.hd = h ?? 0;
    });
    return ps;
  }
}

export const DAY_TRIP_START = 10, DAY_TRIP_END = 17;
/** Trip-hours window of a day-trip activity (10:00 -> 17:00 on its day), or null when it has no day. */
export function dayTripWindow(d: TripData, activityId: string): { t0: number; t1: number } | null {
  const a = d.activities.find(x => x.id === activityId); if (!a || a.kind !== 'day_trip' || !a.day) return null;
  const b = dayIdx(d, a.day) * DAY; return { t0: b + DAY_TRIP_START, t1: b + DAY_TRIP_END };
}

const cache = new WeakMap<TripData, Piece[]>();
/** The full ordered piece list (one piece per rail edge / stay / flight). */
export function segments(d: TripData): Piece[] {
  const hit = cache.get(d); if (hit) return hit;
  const ps = build(d); cache.set(d, ps); return ps;
}

function build(d: TripData): Piece[] {
  const b = new Builder(); const total = totalHours(d);
  const stops = [...d.stops].sort((x, y) => x.ord - y.ord);
  const none = { stopId: null, legId: null, dayTripId: null };
  let cursor = stops.length ? dayIdx(d, stops[0].arrive) * DAY : 0;

  const fin = d.flights.find(f => f.direction === 'in');
  if (fin && stops.length) {
    const land = fin.arriveAt ? isoToHours(d, fin.arriveAt) : 8;
    const pos = airportPos(fin.airport);
    b.push({ t0: land - 3, t1: land, kind: 'flight_in', vehicle: 'plane', pts: [offMap(fin.airport), pos], ...none });
    b.parked(land, land + 1, 'airport_in', pos, null);
    cursor = b.route(airportNode(fin.airport), stopNode(stops[0]), land + 1, null, 'transfer_in', none, undefined, [stops[0].lat, stops[0].lng]);
  }

  const fout = d.flights.find(f => f.direction === 'out');
  stops.forEach((s, i) => {
    const next = stops[i + 1]; const last = !next;
    const leg: Leg | undefined = next && (d.legs.find(l => l.fromStop === s.id && l.toStop === next.id));
    const legId = leg?.id ?? (next ? `leg-${s.id}-${next.id}` : null);
    const sPos: LL = [s.lat, s.lng];
    let stayEnd: number, legArr = 0, legDep = 0;
    // flight-out timing
    let outStart = 0, outEnd = 0, planeStart = 0;
    if (next) {
      legDep = Math.max(cursor, dayIdx(d, s.depart) * DAY + hhmm(leg?.departTime, 10));
      legArr = dayIdx(d, s.depart) * DAY + hhmm(leg?.arriveTime, 14); if (legArr <= legDep) legArr += DAY;
      stayEnd = legDep;
    } else if (fout) {
      const dep = fout.departAt ? isoToHours(d, fout.departAt) : dayIdx(d, d.trip.endDate) * DAY + 11;
      const aptArr = dep - 2.5; const real = shortestPath(stopNode(s), airportNode(fout.airport)).reduce((a, x) => a + x.edge.minutes, 0) / 60 || 0.5;
      outStart = Math.max(cursor, aptArr - real); outEnd = outStart + real; planeStart = Math.max(dep, outEnd);
      stayEnd = outStart;
    } else stayEnd = Math.max(cursor, total);

    // stay with day trips carved out
    const trips = d.activities.filter(a => a.stopId === s.id && a.kind === 'day_trip' && a.day && a.destLat != null && a.destLng != null)
      .map(a => ({ a, w: dayTripWindow(d, a.id)! })).filter(x => x.w.t0 >= cursor && x.w.t1 <= stayEnd).sort((x, y) => x.w.t0 - y.w.t0);
    let t = cursor; const sNode = stopNode(s);
    for (const { a, w } of trips) {
      if (w.t0 < t) continue;
      b.parked(t, w.t0, 'stay', sPos, s.id);
      const dest: LL = [a.destLat!, a.destLng!]; const dn = nearestNode(dest, 8);
      const ids = { stopId: s.id, legId: null, dayTripId: a.id }; const veh = modeVehicle(a.mode);
      const mid0 = w.t0 + 2.5, mid1 = w.t1 - 2.5;
      if (dn) b.route(sNode, dn, w.t0, mid0, 'trip_out', ids, sPos, dest, veh);
      else b.push({ t0: w.t0, t1: mid0, kind: 'trip_out', vehicle: veh, pts: [sPos, dest], ...ids });
      b.parked(mid0, mid1, 'trip_stay', dest, s.id, a.id);
      if (dn) b.route(dn, sNode, mid1, w.t1, 'trip_back', ids, dest, sPos, veh);
      else b.push({ t0: mid1, t1: w.t1, kind: 'trip_back', vehicle: veh, pts: [dest, sPos], ...ids });
      t = w.t1;
    }
    b.parked(t, stayEnd, 'stay', sPos, s.id);
    if (stayEnd <= t && !last) { /* zero-length stay: nothing */ }

    if (next) {
      b.route(sNode, stopNode(next), legDep, legArr, 'leg', { stopId: null, legId, dayTripId: null }, sPos, [next.lat, next.lng]);
      cursor = legArr;
    } else if (fout) {
      const apt = airportPos(fout.airport);
      b.route(sNode, airportNode(fout.airport), outStart, outEnd, 'transfer_out', none, sPos, apt);
      b.parked(outEnd, planeStart, 'airport_out', apt, null);
      b.push({ t0: planeStart, t1: planeStart + 3, kind: 'flight_out', vehicle: 'plane', pts: [apt, offMap(fout.airport)], ...none });
    }
  });
  if (!b.pieces.length) b.parked(0, total, 'stay', [CITIES.tokyo.lat, CITIES.tokyo.lng], null);
  return b.finish();
}

export function stateAt(d: TripData, hours: number): TimelineState {
  const ps = segments(d);
  // last piece with t0 <= hours
  let lo = 0, hi = ps.length - 1;
  if (hours < ps[0].t0) hi = 0; else while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ps[m].t0 <= hours) lo = m; else hi = m - 1; }
  const p = ps[lo];
  const raw = p.t1 > p.t0 ? (hours - p.t0) / (p.t1 - p.t0) : 1; const u = ease(Math.min(1, Math.max(0, raw)));
  let lat = p.pts[0][0], lng = p.pts[0][1], heading = p.hd;
  if (p.pts.length > 1) {
    const L = p.cum[p.cum.length - 1];
    if (L > 0) {
      const target = u * L; let i = 1; while (i < p.pts.length - 1 && p.cum[i] < target) i++;
      const seg = p.cum[i] - p.cum[i - 1]; const f = seg > 0 ? (target - p.cum[i - 1]) / seg : 0;
      lat = p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * f; lng = p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * f;
      if (seg > 0) heading = wheading(p.pts[i - 1], p.pts[i]);
    }
  }
  return { vehicle: p.vehicle, lat, lng, heading, stopId: p.stopId, legId: p.legId, dayTripId: p.dayTripId, hours };
}

/** Hours at which the vehicle arrives (starts staying) at each stop, in order. */
export function stopArrivals(d: TripData): { stopId: string; hours: number }[] {
  const out: { stopId: string; hours: number }[] = []; const seen = new Set<string>();
  for (const p of segments(d)) if (p.kind === 'stay' && p.stopId && !seen.has(p.stopId)) { seen.add(p.stopId); out.push({ stopId: p.stopId, hours: p.t0 }); }
  return out;
}
/** Colour spans per stop for the timeline bar: from arrival to next stop's arrival (first starts at 0, last ends at total). */
export function stopSpans(d: TripData): { stop: Stop; t0: number; t1: number }[] {
  const arr = stopArrivals(d); const total = totalHours(d);
  return arr.map((a, i) => ({ stop: d.stops.find(s => s.id === a.stopId)!, t0: i === 0 ? 0 : a.hours, t1: i + 1 < arr.length ? arr[i + 1].hours : total }));
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayInfo(d: TripData, dayIndex: number) {
  const t = new Date(utc(d.trip.startDate) + dayIndex * 864e5);
  return { weekday: WD[t.getUTCDay()], day: t.getUTCDate(), month: MO[t.getUTCMonth()], date: `${t.getUTCDate()} ${MO[t.getUTCMonth()]}`, iso: t.toISOString().slice(0, 10) };
}
export const dayCount = (d: TripData) => Math.round(totalHours(d) / DAY);
/** 'Sat 24 Oct · 14:00' */
export function formatHours(d: TripData, hours: number) {
  const h = Math.max(0, hours); const i = Math.min(dayCount(d) - 1, Math.floor(h / DAY)); const di = dayInfo(d, i);
  const m = Math.floor((h - i * DAY) * 60 + 1e-6); const hh = Math.min(23, Math.floor(m / 60)), mm = m % 60;
  return `${di.weekday} ${di.date} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Inbound leg summary: route steps with vehicles/lines/minutes plus real departure/arrival hours. */
export function legRoute(d: TripData, leg: Leg) {
  const from = d.stops.find(s => s.id === leg.fromStop), to = d.stops.find(s => s.id === leg.toStop);
  if (!from || !to) return null;
  const steps = shortestPath(stopNode(from), stopNode(to)).map(st => ({ mode: st.edge.mode, line: st.edge.line, minutes: st.edge.minutes }));
  const p = segments(d).filter(x => x.legId === leg.id);
  return { from, to, steps, minutes: steps.reduce((a, s) => a + s.minutes, 0), t0: p[0]?.t0 ?? null, t1: p[p.length - 1]?.t1 ?? null };
}
