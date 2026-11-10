// Bakes web/src/assets/landmask.png from japan.json + RANGES.
// R = signed coast distance (128 = coastline, >128 land, <128 sea; +-MASK.sdfRange world units over 0..255)
// G = ridge proximity (255 on a ridge line, 0 beyond ~1.6 half-widths)
// B = reserved (0)   A = 255
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { POLYS, onLand } from '../web/src/scene/terrain/geometry';
import { RANGES, MASK } from '../web/src/scene/terrain/ranges';
import { toWorld } from '../web/src/geo';

const { x0, x1, z0, z1, w, h, sdfRange } = MASK;
const segs: number[][] = [];
for (const p of POLYS) for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; segs.push([p[i][0], p[i][1], q[0], q[1]]); }
function dSeg(px: number, pz: number, s: number[]) {
  const dx = s[2] - s[0], dz = s[3] - s[1];
  const t = Math.max(0, Math.min(1, ((px - s[0]) * dx + (pz - s[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - s[0] - t * dx, pz - s[1] - t * dz);
}
const ridges = RANGES.map((r) => ({
  w: r.w * 16,
  s: r.pts.slice(0, -1).map((a, i) => { const b = r.pts[i + 1]; const A = toWorld(a[0], a[1]), B = toWorld(b[0], b[1]); return [A[0], A[1], B[0], B[1]]; }),
}));

const raw = Buffer.alloc((w * 4 + 1) * h);
for (let j = 0; j < h; j++) {
  raw[j * (w * 4 + 1)] = 0;
  for (let i = 0; i < w; i++) {
    const x = x0 + ((i + 0.5) / w) * (x1 - x0), z = z0 + ((j + 0.5) / h) * (z1 - z0);
    let d = 1e9;
    for (const s of segs) { const v = dSeg(x, z, s); if (v < d) d = v; }
    d = Math.min(d, sdfRange);
    const sd = onLand(x, z) ? d : -d;
    let ridge = 0;
    for (const r of ridges) { let m = 1e9; for (const s of r.s) m = Math.min(m, dSeg(x, z, s)); ridge = Math.max(ridge, 1 - Math.min(1, m / (r.w * 1.6))); }
    const o = j * (w * 4 + 1) + 1 + i * 4;
    raw[o] = Math.round(128 + (sd / sdfRange) * 127);
    raw[o + 1] = Math.round(ridge * 255);
    raw[o + 2] = 0; raw[o + 3] = 255;
  }
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
mkdirSync('web/src/assets', { recursive: true });
writeFileSync('web/src/assets/landmask.png', png);
console.log('landmask.png', w, 'x', h, png.length, 'bytes');
