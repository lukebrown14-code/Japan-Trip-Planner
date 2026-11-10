import * as THREE from 'three';
/** Flat-shaded rectangular ribbon (box cross-section) extruded along points. Top surface at p.y, bottom at p.y-thickness. */
export function ribbonGeometry(pts: THREE.Vector3[], width: number, thickness: number): THREE.BufferGeometry {
  const n = pts.length; const pos: number[] = []; const idx: number[] = [];
  const hw = width / 2; const t = new THREE.Vector3(); const r = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]); t.y = 0; if (t.lengthSq() < 1e-12) t.set(1, 0, 0); t.normalize();
    r.set(-t.z, 0, t.x);
    const p = pts[i]; const TL = [p.x - r.x * hw, p.y, p.z - r.z * hw], TR = [p.x + r.x * hw, p.y, p.z + r.z * hw];
    const BL = [TL[0], p.y - thickness, TL[2]], BR = [TR[0], p.y - thickness, TR[2]];
    pos.push(...TL, ...TR, ...TR, ...BR, ...BR, ...BL, ...BL, ...TL);
  }
  for (let i = 0; i < n - 1; i++) for (let f = 0; f < 4; f++) {
    const a = i * 8 + f * 2, b = a + 1, c = a + 8, d = a + 9;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Poses (position + yaw) every `spacing` along a curve, for instancing sleepers / pillars / dashes. */
export function posesAlong(curve: THREE.Curve<THREE.Vector3>, spacing: number, startOffset = 0) {
  const L = curve.getLength(); const out: { p: THREE.Vector3; yaw: number }[] = [];
  for (let d = startOffset; d <= L; d += spacing) { const u = d / L; const p = curve.getPointAt(u); const t = curve.getTangentAt(u); out.push({ p, yaw: Math.atan2(-t.z, t.x) }); }
  return out;
}
