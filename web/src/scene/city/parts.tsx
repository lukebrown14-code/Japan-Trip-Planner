import { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { toonMat, OUTLINE, Outlined } from '../toon';
import { nightNow } from './util';

type V3 = [number, number, number];
export interface PartProps { p?: V3; s?: V3; r?: V3; c: string; outline?: boolean; cast?: boolean }
const O = ({ on = true, t = 1 }: { on?: boolean; t?: number }) => on ? <Outlined thickness={OUTLINE.thickness * t} color={OUTLINE.color} /> : null;

/** Toon box. p = centre position, s = size. Origin is the box centre. */
export function Box({ p = [0, 0, 0], s = [1, 1, 1], r, c, outline = true, cast = true }: PartProps) {
  return <mesh position={p} rotation={r} castShadow={cast}><boxGeometry args={s} /><primitive object={toonMat(c)} attach="material" /><O on={outline} /></mesh>;
}
/** Cylinder / cone / frustum. s = [rTop, rBottom, height, radialSegs]. */
export function Cyl({ p = [0, 0, 0], s = [0.5, 0.5, 1, 12], r, c, outline = true, cast = true }: Omit<PartProps, 's'> & { s?: [number, number, number, number?] }) {
  return <mesh position={p} rotation={r} castShadow={cast}><cylinderGeometry args={[s[0], s[1], s[2], s[3] ?? 12]} /><primitive object={toonMat(c)} attach="material" /><O on={outline} /></mesh>;
}
export function Ball({ p = [0, 0, 0], rad = 0.5, c, outline = true, sc }: { p?: V3; rad?: number; c: string; outline?: boolean; sc?: V3 }) {
  return <mesh position={p} scale={sc} castShadow><icosahedronGeometry args={[rad, 1]} /><primitive object={toonMat(c, { flatShading: true })} attach="material" /><O on={outline} /></mesh>;
}
/** Four-sided hip roof (pyramid) sitting on a w x d footprint, base at p.y. */
export function Roof({ p = [0, 0, 0], w, d, h, c, over = 0.12, outline = true }: { p?: V3; w: number; d: number; h: number; c: string; over?: number; outline?: boolean }) {
  return <mesh position={[p[0], p[1] + h / 2, p[2]]} rotation={[0, Math.PI / 4, 0]} scale={[(w + over * 2) * Math.SQRT1_2, 1, (d + over * 2) * Math.SQRT1_2]} castShadow>
    <coneGeometry args={[1, h, 4]} /><primitive object={toonMat(c)} attach="material" /><O on={outline} /></mesh>;
}
/** Gable roof (triangular prism) ridge along X. */
export function Gable({ p = [0, 0, 0], w, d, h, c, over = 0.1, outline = true }: { p?: V3; w: number; d: number; h: number; c: string; over?: number; outline?: boolean }) {
  const geo = useMemo(() => {
    const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g;
  }, []);
  // extrude depth is along Z; shape spans X(d) -> rotate so ridge runs along X
  return <mesh geometry={geo} position={[p[0], p[1], p[2]]} rotation={[0, Math.PI / 2, 0]} scale={[d + over * 2, h, w + over * 2]} castShadow>
    <primitive object={toonMat(c)} attach="material" /><O on={outline} /></mesh>;
}
/** Self-lit emissive box that brightens at night. */
export function Glow({ p = [0, 0, 0], s = [1, 1, 1], c, day = 0.55, kind = 'box' }: { p?: V3; s?: V3; c: string; day?: number; kind?: 'box' | 'ball' }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null!);
  const col = useMemo(() => new THREE.Color(c), [c]);
  useFrame(() => { const n = nightNow(); ref.current.color.copy(col).multiplyScalar(day + (1.25 - day) * n); });
  return <mesh position={p} scale={kind === 'ball' ? s : undefined}>
    {kind === 'box' ? <boxGeometry args={s} /> : <icosahedronGeometry args={[1, 1]} />}
    <meshBasicMaterial ref={ref} color={c} toneMapped={false} /></mesh>;
}
/** Wooden torii gate facing +Z. h = pillar height. */
export function Torii({ p = [0, 0, 0], h = 1, r = [0, 0, 0], c = '#d8321f', outline = false }: { p?: V3; h?: number; r?: V3; c?: string; outline?: boolean }) {
  const w = h * 0.8, t = h * 0.07;
  return <group position={p} rotation={r}>
    <Cyl p={[-w / 2, h / 2, 0]} s={[t, t * 1.15, h, 8]} c={c} outline={outline} />
    <Cyl p={[w / 2, h / 2, 0]} s={[t, t * 1.15, h, 8]} c={c} outline={outline} />
    <Box p={[0, h * 0.78, 0]} s={[w + t * 2.5, t * 0.9, t * 1.2]} c={c} outline={outline} />
    <Box p={[0, h * 1.0, 0]} s={[w * 1.5, t * 1.2, t * 2]} c="#2a2230" outline={outline} r={[0, 0, 0]} />
    <Box p={[0, h * 1.07, 0]} s={[w * 1.6, t * 0.7, t * 2.4]} c="#2a2230" outline={outline} />
  </group>;
}

/** Generic helper: place many identical geometry instances with per-instance colour. */
export interface Inst { p: V3; s?: V3 | number; ry?: number; c?: string }
export function Instances({ geo, items, mat = '#ffffff', shadow = true }: { geo: THREE.BufferGeometry; items: Inst[]; mat?: string; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = ref.current, o = new THREE.Object3D(), col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p); o.rotation.set(0, it.ry ?? 0, 0);
      const s = it.s ?? 1; typeof s === 'number' ? o.scale.setScalar(s) : o.scale.set(...s);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.set(it.c ?? '#ffffff'));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, toonMat(mat), items.length]} castShadow={shadow} frustumCulled={false} />;
}
