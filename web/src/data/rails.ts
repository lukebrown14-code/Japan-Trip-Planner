import type { Mode } from '@shared/types';
export interface RailNode { id: string; lat: number; lng: number }
export interface RailEdge { a: string; b: string; mode: Mode; line: string; via?: [number, number][]; minutes: number }
export const NODES: RailNode[] = [
  { id: 'hnd', lat: 35.549, lng: 139.78 }, { id: 'nrt', lat: 35.772, lng: 140.393 },
  { id: 'tokyo', lat: 35.681, lng: 139.767 }, { id: 'omiya', lat: 35.906, lng: 139.624 },
  { id: 'utsunomiya', lat: 36.559, lng: 139.898 }, { id: 'nikko', lat: 36.75, lng: 139.598 },
  { id: 'nagano', lat: 36.643, lng: 138.188 }, { id: 'toyama', lat: 36.701, lng: 137.213 },
  { id: 'takayama', lat: 36.14, lng: 137.252 }, { id: 'nagoya', lat: 35.171, lng: 136.882 },
  { id: 'kyoto', lat: 35.003, lng: 135.759 }, { id: 'osaka', lat: 34.703, lng: 135.497 },
  { id: 'odawara', lat: 35.256, lng: 139.155 }, { id: 'hakone', lat: 35.233, lng: 139.107 },
  { id: 'nara', lat: 34.685, lng: 135.805 }, { id: 'shirakawago', lat: 36.257, lng: 136.906 },
  { id: 'kanazawa', lat: 36.578, lng: 136.648 }, { id: 'kamakura', lat: 35.319, lng: 139.547 },
  { id: 'hiroshima', lat: 34.397, lng: 132.475 }, { id: 'miyajima', lat: 34.296, lng: 132.319 },
  { id: 'fukuoka', lat: 33.59, lng: 130.42 }, { id: 'sapporo', lat: 43.069, lng: 141.351 },
];
export const EDGES: RailEdge[] = [
  { a: 'hnd', b: 'tokyo', mode: 'train', line: 'Keikyu', minutes: 30 },
  { a: 'nrt', b: 'tokyo', mode: 'limited_express', line: 'Narita Express', minutes: 55 },
  { a: 'tokyo', b: 'omiya', mode: 'shinkansen', line: 'Tohoku', minutes: 25 },
  { a: 'omiya', b: 'utsunomiya', mode: 'shinkansen', line: 'Tohoku', minutes: 30 },
  { a: 'utsunomiya', b: 'nikko', mode: 'train', line: 'Nikko', minutes: 45 },
  { a: 'omiya', b: 'nagano', mode: 'shinkansen', line: 'Hokuriku', via: [[36.4, 138.7]], minutes: 80 },
  { a: 'nagano', b: 'toyama', mode: 'shinkansen', line: 'Hokuriku', via: [[36.7, 137.7]], minutes: 45 },
  { a: 'toyama', b: 'takayama', mode: 'limited_express', line: 'Hida', via: [[36.4, 137.2]], minutes: 90 },
  { a: 'takayama', b: 'nagoya', mode: 'limited_express', line: 'Hida', via: [[35.7, 137.0]], minutes: 150 },
  { a: 'takayama', b: 'shirakawago', mode: 'bus', line: 'Nohi Bus', minutes: 50 },
  { a: 'nagoya', b: 'kyoto', mode: 'shinkansen', line: 'Tokaido', minutes: 35 },
  { a: 'kyoto', b: 'osaka', mode: 'shinkansen', line: 'Tokaido', minutes: 15 },
  { a: 'kyoto', b: 'nara', mode: 'train', line: 'Kintetsu', minutes: 45 },
  { a: 'tokyo', b: 'odawara', mode: 'shinkansen', line: 'Tokaido', via: [[35.45, 139.64]], minutes: 35 },
  { a: 'odawara', b: 'hakone', mode: 'train', line: 'Hakone Tozan', minutes: 15 },
  { a: 'odawara', b: 'nagoya', mode: 'shinkansen', line: 'Tokaido', via: [[35.1, 138.9], [34.97, 138.4]], minutes: 90 },
  { a: 'osaka', b: 'nara', mode: 'train', line: 'Kintetsu Nara', minutes: 40 },
  { a: 'toyama', b: 'kanazawa', mode: 'shinkansen', line: 'Hokuriku', via: [[36.65, 136.9]], minutes: 25 },
  { a: 'tokyo', b: 'kamakura', mode: 'train', line: 'JR Yokosuka', via: [[35.45, 139.64]], minutes: 55 },
  { a: 'osaka', b: 'hiroshima', mode: 'shinkansen', line: 'Sanyo', via: [[34.8, 134.7], [34.75, 133.9]], minutes: 85 },
  { a: 'hiroshima', b: 'miyajima', mode: 'train', line: 'JR Sanyo + Miyajima ferry', via: [[34.36, 132.4]], minutes: 45 },
  { a: 'hiroshima', b: 'fukuoka', mode: 'shinkansen', line: 'Sanyo/Kyushu', via: [[34.0, 131.5]], minutes: 65 },
  { a: 'tokyo', b: 'sapporo', mode: 'plane', line: 'Haneda - New Chitose', via: [[39.5, 141.0]], minutes: 150 },
];
const find = (id: string) => NODES.find(n => n.id === id)!;
export interface PathStep { edge: RailEdge; reversed: boolean }
/** Dijkstra by minutes. Returns ordered edges from `from` to `to`. */
export function shortestPath(from: string, to: string): PathStep[] {
  const dist = new Map<string, number>([[from, 0]]); const prev = new Map<string, PathStep & { from: string }>();
  const q = new Set(NODES.map(n => n.id));
  while (q.size) {
    let u: string | null = null;
    for (const id of q) if (dist.has(id) && (u === null || dist.get(id)! < dist.get(u)!)) u = id;
    if (u === null || u === to) break; q.delete(u);
    for (const e of EDGES) {
      const rev = e.b === u; if (e.a !== u && !rev) continue;
      const v = rev ? e.a : e.b; const d = dist.get(u)! + e.minutes;
      if (d < (dist.get(v) ?? Infinity)) { dist.set(v, d); prev.set(v, { edge: e, reversed: rev, from: u }); }
    }
  }
  const out: PathStep[] = []; let cur = to;
  while (cur !== from) { const p = prev.get(cur); if (!p) return []; out.unshift({ edge: p.edge, reversed: p.reversed }); cur = p.from; }
  return out;
}
export const nodePos = (id: string) => { const n = find(id); return [n.lat, n.lng] as [number, number]; };
