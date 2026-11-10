import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Instances, type Inst } from './parts';
import { rng, pick, AUTUMN, nightNow } from './util';

export type TreeKind = 'momiji' | 'cedar';
export interface ScatterOpts { seed: number; radius: number; clear: number; houses: number; trees: number; treeKind: TreeKind; wall?: string[]; roof?: string[]; roadHalf?: number; keepOut?: (x: number, z: number) => boolean }

const WALLS = ['#f1e4c8', '#e9d3a8', '#f6efe0', '#d9b98a'];
const ROOFS = ['#3d4a6b', '#5a3e3a', '#2f4a52', '#7a3b34', '#4a4458'];

// shared unit geometries
const G = {
  body: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  hip: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  trunk: new THREE.CylinderGeometry(0.05, 0.07, 1, 6).translate(0, 0.5, 0),
  canopy: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
  lamp: new THREE.CylinderGeometry(0.02, 0.025, 1, 5).translate(0, 0.5, 0),
};
const gable = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2); return g; })();

export function layout(o: ScatterOpts) {
  const r = rng(o.seed), pts: { x: number; z: number; w: number }[] = [];
  const rh = o.roadHalf ?? 0.28;
  const ok = (x: number, z: number, m: number) => {
    const d = Math.hypot(x, z);
    if (d < o.clear || d > o.radius - 0.25) return false;
    if (o.keepOut?.(x, z)) return false;
    return pts.every(p => Math.hypot(p.x - x, p.z - z) > m + p.w);
  };
  const houses: Inst[] = [], roofsHip: Inst[] = [], roofsGable: Inst[] = [], bodies: Inst[] = [];
  for (let i = 0, tries = 0; i < o.houses && tries < 400; tries++) {
    const a = r() * Math.PI * 2, d = o.clear + r() * (o.radius - o.clear);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < rh || Math.abs(z) < rh) continue;
    const w = 0.4 + r() * 0.3, dp = 0.35 + r() * 0.25, h = 0.28 + r() * 0.3;
    if (!ok(x, z, 0.3)) continue;
    pts.push({ x, z, w: w / 2 }); i++;
    const ry = Math.round(r() * 2) * (Math.PI / 2) + (r() - 0.5) * 0.15;
    const wc = pick(r, o.wall ?? WALLS), rc = pick(r, o.roof ?? ROOFS), rh2 = 0.2 + r() * 0.22;
    bodies.push({ p: [x, 0.2, z], s: [w, h, dp], ry, c: wc });
    const topY = 0.2 + h;
    if (r() < 0.5) roofsHip.push({ p: [x, topY, z], s: [w * 1.35, rh2, dp * 1.35], ry, c: rc });
    else roofsGable.push({ p: [x, topY, z], s: [w * 1.3, rh2 * 1.1, dp * 1.3], ry, c: rc });
  }
  void houses;
  // trees
  const trees: { trunk: Inst; crown: Inst[]; kind: TreeKind }[] = [];
  const crownsA: Inst[] = [], trunks: Inst[] = [], cedars: Inst[] = [];
  for (let i = 0, tries = 0; i < o.trees && tries < 600; tries++) {
    const a = r() * Math.PI * 2, d = (o.treeKind === 'cedar' ? o.clear * 0.7 : o.clear * 0.9) + r() * (o.radius - 0.1 - o.clear * 0.8);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (o.keepOut?.(x, z) || Math.hypot(x, z) > o.radius - 0.15) continue;
    if (pts.some(p => Math.hypot(p.x - x, p.z - z) < p.w + 0.22)) continue;
    if ((Math.abs(x) < rh * 0.8 || Math.abs(z) < rh * 0.8) && o.treeKind === 'momiji') continue;
    pts.push({ x, z, w: 0.02 }); i++;
    const s = 0.8 + r() * 0.6;
    if (o.treeKind === 'cedar') {
      const h = 1.3 * s + r() * 0.5;
      trunks.push({ p: [x, 0.2, z], s: [1, h * 0.35, 1], c: '#4a3326' });
      [0, 1, 2].forEach(k => cedars.push({ p: [x, 0.2 + h * (0.12 + k * 0.26), z], s: [0.3 * s * (1 - k * 0.22), h * 0.42, 0.3 * s * (1 - k * 0.22)], c: pick(r, ['#2f5a3c', '#27493a', '#3a6a40']) }));
    } else {
      trunks.push({ p: [x, 0.2, z], s: [1, 0.45 * s, 1], c: '#5a3c2a' });
      crownsA.push({ p: [x, 0.2 + 0.55 * s, z], s: [0.26 * s, 0.24 * s, 0.26 * s], ry: r() * 3, c: pick(r, AUTUMN) });
    }
  }
  // lanterns on the cross roads
  const lamps: { x: number; z: number }[] = [];
  const step = 0.85, ext = o.radius - 0.4;
  for (let t = -ext; t <= ext; t += step) {
    if (Math.abs(t) > o.clear * 0.6) { lamps.push({ x: t, z: rh + 0.04 }, { x: -t, z: -rh - 0.04 }); lamps.push({ x: rh + 0.04, z: -t }, { x: -rh - 0.04, z: t }); }
  }
  void trees;
  return { bodies, roofsHip, roofsGable, trunks, crownsA, cedars, lamps: lamps.filter(l => Math.hypot(l.x, l.z) < o.radius - 0.3) };
}

export function Scatter(o: ScatterOpts) {
  const L = useMemo(() => layout(o), [o.seed, o.radius, o.clear, o.houses, o.trees, o.treeKind]); // eslint-disable-line react-hooks/exhaustive-deps
  return <group>
    <Instances geo={G.body} items={L.bodies} />
    <Instances geo={G.hip} items={L.roofsHip} />
    <Instances geo={gable} items={L.roofsGable} />
    <Instances geo={G.trunk} items={L.trunks} />
    <Instances geo={G.canopy} items={L.crownsA} />
    <Instances geo={G.cone} items={L.cedars} />
    <Lanterns pts={L.lamps} />
  </group>;
}

/** Street lanterns: warm paper bulbs that glow at night. */
export function Lanterns({ pts, y = 0.2 }: { pts: { x: number; z: number }[]; y?: number }) {
  const poles = useMemo(() => pts.map(p => ({ p: [p.x, y, p.z] as [number, number, number], s: [1, 0.42, 1] as [number, number, number], c: '#3b2a24' })), [pts, y]);
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const halo = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!), hmat = useRef<THREE.MeshBasicMaterial>(null!);
  const base = useMemo(() => new THREE.Color('#ffb85c'), []);
  const setup = (m: THREE.InstancedMesh | null, k: number) => {
    if (!m) return; const o = new THREE.Object3D();
    pts.forEach((p, i) => { o.position.set(p.x, y + 0.46, p.z); o.scale.setScalar(k); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  };
  useFrame(() => {
    const n = nightNow();
    if (mat.current) mat.current.color.copy(base).multiplyScalar(0.55 + 0.9 * n);
    if (hmat.current) hmat.current.opacity = n * 0.38;
    if (halo.current) halo.current.visible = n > 0.02;
  });
  return <group>
    <Instances geo={G.lamp} items={poles} shadow={false} />
    <instancedMesh ref={m => { bulbs.current = m!; setup(m, 0.055); }} args={[undefined, undefined, pts.length]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial ref={mat} toneMapped={false} color="#ffb85c" /></instancedMesh>
    <instancedMesh ref={m => { halo.current = m!; setup(m, 0.2); }} args={[undefined, undefined, pts.length]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial ref={hmat} transparent opacity={0} depthWrite={false} color="#ffc873" toneMapped={false} /></instancedMesh>
  </group>;
}
