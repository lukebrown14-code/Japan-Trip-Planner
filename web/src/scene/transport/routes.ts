// Pure route geometry for Rails & vehicles. Exported for Timeline/others: legCurve, legSegments, nodeKey, samplePath.
import * as THREE from 'three';
import { CITIES } from '../../data/cities';
import { EDGES, NODES, shortestPath, type PathStep, type RailEdge } from '../../data/rails';
import { toWorld } from '../../geo';
import type { TripData, Mode } from '@shared/types';

/** Island top surface height (tune if Terrain differs). */
export const GROUND = 0.4;
/** Viaduct deck height above ground for the highlighted trip route. */
export const ELEV = 0.55;
export const DECK_Y = GROUND + ELEV;

const nodeById = new Map(NODES.map(n => [n.id, n]));
/** City key ('tokyo','hakone'...) or rail node id ('hnd','odawara') -> rail node id. Hakone -> 'hakone' (route runs odawara->hakone). */
export function nodeKey(key: string): string {
  const k = key.toLowerCase();
  if (k === 'hakone') return 'hakone';
  if (nodeById.has(k)) return k;
  return CITIES[key]?.station ?? k;
}
export const edgeId = (e: RailEdge) => `${e.a}-${e.b}`;
const world = (lat: number, lng: number): [number, number] => toWorld(lat, lng);

/** World [x,z] points of an edge, canonical a->b (or reversed). */
export function edgeXZ(step: { edge: RailEdge; reversed?: boolean }): [number, number][] {
  const e = step.edge; const a = nodeById.get(e.a)!, b = nodeById.get(e.b)!;
  const pts = [world(a.lat, a.lng), ...(e.via ?? []).map(v => world(v[0], v[1])), world(b.lat, b.lng)];
  return step.reversed ? pts.reverse() : pts;
}
const curveCache = new Map<string, THREE.CatmullRomCurve3>();
export function edgeCurve(step: { edge: RailEdge; reversed?: boolean }, y = DECK_Y): THREE.CatmullRomCurve3 {
  const k = edgeId(step.edge) + (step.reversed ? 'r' : '') + y;
  let c = curveCache.get(k);
  if (!c) { c = new THREE.CatmullRomCurve3(edgeXZ(step).map(([x, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal'); curveCache.set(k, c); }
  return c;
}

export interface LegSegment { mode: Mode; line: string; edge: RailEdge; reversed: boolean; curve: THREE.CatmullRomCurve3; u0: number; u1: number }
export interface LegRoute { path: THREE.CurvePath<THREE.Vector3>; segments: LegSegment[]; steps: PathStep[]; length: number }
const legCache = new Map<string, LegRoute>();
/** Full routed geometry between two cities/nodes. Follow `path.getPointAt(u)` / `getTangentAt(u)`; `segments` give the vehicle mode per u-range. */
export function legRoute(fromKey: string, toKey: string, y = DECK_Y): LegRoute {
  const ck = `${fromKey}>${toKey}@${y}`; const hit = legCache.get(ck); if (hit) return hit;
  const from = nodeKey(fromKey), to = nodeKey(toKey);
  const steps = from === to ? [] : shortestPath(from, to);
  const path = new THREE.CurvePath<THREE.Vector3>();
  const curves = steps.map(s => edgeCurve(s, y));
  if (!curves.length) {
    const a = nodeById.get(from), b = nodeById.get(to);
    const [ax, az] = a ? world(a.lat, a.lng) : [0, 0], [bx, bz] = b ? world(b.lat, b.lng) : [0.01, 0];
    path.add(new THREE.LineCurve3(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz)) as unknown as THREE.Curve<THREE.Vector3>);
  } else curves.forEach(c => path.add(c));
  const length = path.getLength() || 1; let acc = 0;
  const segments = steps.map((s, i) => { const l = curves[i].getLength(); const seg = { mode: s.edge.mode, line: s.edge.line, edge: s.edge, reversed: s.reversed, curve: curves[i], u0: acc / length, u1: (acc + l) / length }; acc += l; return seg; });
  const r = { path, segments, steps, length }; legCache.set(ck, r); return r;
}
/** Curve a vehicle follows between two cities (or airports 'hnd'/'nrt'). */
export const legCurve = (fromCityKey: string, toCityKey: string, y = DECK_Y) => legRoute(fromCityKey, toCityKey, y).path;
/** Evenly spaced world points along a curve. */
export const samplePath = (c: THREE.Curve<THREE.Vector3>, spacing = 0.08) => c.getSpacedPoints(Math.max(2, Math.ceil(c.getLength() / spacing)));

export interface TripLeg { id: string; from: string; to: string }
/** All routed legs of the trip incl. airport transfers (first flight-in airport -> first stop, last stop -> flight-out airport). */
export function tripLegs(d: TripData): TripLeg[] {
  const out: TripLeg[] = []; const stopById = new Map(d.stops.map(s => [s.id, s]));
  const stops = [...d.stops].sort((a, b) => a.ord - b.ord);
  const fin = d.flights.find(f => f.direction === 'in'), fout = d.flights.find(f => f.direction === 'out');
  if (fin && stops[0]) out.push({ id: 'air-in', from: fin.airport.toLowerCase(), to: stops[0].cityKey });
  for (const l of d.legs) { const a = stopById.get(l.fromStop), b = stopById.get(l.toStop); if (a && b) out.push({ id: l.id, from: a.cityKey, to: b.cityKey }); }
  if (fout && stops.length) out.push({ id: 'air-out', from: stops[stops.length - 1].cityKey, to: fout.airport.toLowerCase() });
  return out;
}
export const worldOf = (lat: number, lng: number) => toWorld(lat, lng);
export { EDGES };
