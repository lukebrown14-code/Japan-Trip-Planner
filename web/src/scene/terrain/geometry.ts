import japan from '../../data/japan.json';
import { toWorld } from '../../geo';

export type Pt = [number, number];
/** Japan polygons in world (x,z), consecutive duplicates removed. */
export const POLYS: Pt[][] = (japan as number[][][]).map((ring) => {
  const out: Pt[] = [];
  for (const [lng, lat] of ring) {
    const p = toWorld(lat, lng);
    const l = out[out.length - 1];
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.01) out.push(p);
  }
  return out;
});

export function signedArea(p: Pt[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a / 2;
}
export function bbox(p: Pt[]) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0, x1, z0, z1 };
}
export const BOXES = POLYS.map(bbox);
function inPoly(x: number, z: number, p: Pt[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function onLand(x: number, z: number) {
  for (let k = 0; k < POLYS.length; k++) {
    const b = BOXES[k];
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    if (inPoly(x, z, POLYS[k])) return true;
  }
  return false;
}
/** land with a margin (4 probes) so scattered objects don't overhang the coast */
export function onLandMargin(x: number, z: number, m = 0.18) {
  return onLand(x, z) && onLand(x + m, z) && onLand(x - m, z) && onLand(x, z + m) && onLand(x, z - m);
}

/** Outward (away from land) unit normals per vertex, smoothed over +-2 neighbours. */
export function outwardNormals(p: Pt[]): Pt[] {
  const s = signedArea(p) > 0 ? 1 : -1;
  const n = p.length;
  return p.map((_, i) => {
    let nx = 0, nz = 0;
    for (let k = -2; k <= 2; k++) {
      const a = p[(i + k + n) % n], b = p[(i + k + 1 + n) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      nx += (s * dz) / l; nz += (-s * dx) / l;
    }
    const l = Math.hypot(nx, nz) || 1;
    return [nx / l, nz / l] as Pt;
  });
}

/** mulberry32 */
export function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
