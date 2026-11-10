import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
const all: any = feature(topo, topo.objects.countries);
const jp = all.features.find((f: any) => f.properties.name === 'Japan');
const polys: number[][][][] = jp.geometry.type === 'Polygon' ? [jp.geometry.coordinates] : jp.geometry.coordinates;
const area = (r: number[][]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
function rdp(pts: number[][], eps: number): number[][] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1e-9);
    if (d > max) { max = d; idx = i; }
  }
  if (max > eps) return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  return [a, b];
}
const kept = polys.filter(p => area(p[0]) > 0.08 && p[0][0][1] > 30 && p[0][0][0] > 128 || area(p[0]) > 0.08)
  .filter(p => p[0].every(([x]) => x < 146.5 || true))
  .map(p => rdp(p[0].slice(0, -1), 0.012).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]))
  .filter(r => r.length >= 4);
writeFileSync('web/src/data/japan.json', JSON.stringify(kept));
console.log('polygons', kept.length, 'points', kept.reduce((a, r) => a + r.length, 0));
