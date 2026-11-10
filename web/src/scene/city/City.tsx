import type React from "react";
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { LandmarkKind } from '../../data/cities';
import { toonMat, OUTLINE, Outlined } from '../toon';
import { Scatter, type ScatterOpts } from './Scatter';
import { hashStr } from './util';
import { Tokyo } from '../landmarks/Tokyo'; import { Nikko } from '../landmarks/Nikko'; import { Takayama } from '../landmarks/Takayama';
import { LANDMARKS } from '../landmarks';
import { CANDIDATE_SCALE, mutedHex } from './candidate';
const WALLS = ['#f1e4c8', '#e9d3a8', '#f6efe0', '#d9b98a'], ROOFS = ['#3d4a6b', '#5a3e3a', '#2f4a52', '#7a3b34', '#4a4458'];
import { Kyoto } from '../landmarks/Kyoto'; import { Osaka } from '../landmarks/Osaka'; import { Hakone } from '../landmarks/Hakone'; import { Generic } from '../landmarks/Generic';

export const PLATE_Y = 0.2, R = 3.4;
/** Screen-label anchor height above each landmark (used by LabelLayer). */
export const LABEL_Y: Record<string, number> = { tokyo: 7, nikko: 4.6, takayama: 3.6, kyoto: 5.6, osaka: 4.8, hakone: 3.8, generic: 3.2 };
type Cfg = { Lm: React.ComponentType; clear: number; houses: number; trees: number; treeKind: ScatterOpts['treeKind']; plate: string; wall?: string[]; roof?: string[]; keepOut?: (x: number, z: number) => boolean };
const TIMBER = ['#6a4a38', '#5a3e30', '#7a5a42'];
const CFG: Partial<Record<LandmarkKind, Cfg>> & { generic: Cfg } = {
  tokyo: { Lm: Tokyo, clear: 2.5, houses: 12, trees: 8, treeKind: 'momiji', plate: '#9aa3b8', wall: ['#cfd6e4', '#b9c3d6', '#e1e4ee'], roof: ['#4a5a7a', '#3d4a6b'] },
  nikko: { Lm: Nikko, clear: 1.2, houses: 6, trees: 34, treeKind: 'cedar', plate: '#7d9a6a', keepOut: (x, z) => Math.abs(z) < 0.75 || (Math.abs(x) < 1.0 && z < -1.2 && z > -2.8) },
  takayama: { Lm: Takayama, clear: 1.2, houses: 12, trees: 14, treeKind: 'momiji', plate: '#b8a574', wall: TIMBER, roof: ['#2d3139', '#3a3f47'], keepOut: (x, z) => Math.abs(z) < 1.3 || Math.abs(x - 1.9) < 0.5 },
  kyoto: { Lm: Kyoto, clear: 1.5, houses: 8, trees: 16, treeKind: 'momiji', plate: '#c9ae78', keepOut: (x, z) => x > 0.3 && z > -0.2 && z < 3.5 && Math.abs(x - 1.5 - (z - 0.5) * 0.75) < 1.0 && false },
  osaka: { Lm: Osaka, clear: 1.2, houses: 6, trees: 6, treeKind: 'momiji', plate: '#a9a9b5', keepOut: (x, z) => Math.abs(z - 1.55) < 1.4 || (x + 0.3) ** 2 + (z + 0.7) ** 2 < 3.4 },
  hakone: { Lm: Hakone, clear: 1.0, houses: 4, trees: 24, treeKind: 'cedar', plate: '#8fa86e', keepOut: (x, z) => (x - 0.9) ** 2 / 3.2 + (z - 0.9) ** 2 / 1.9 < 1.0 || (x + 1.2) ** 2 + (z + 0.9) ** 2 < 2.5 },
  generic: { Lm: Generic, clear: 1.6, houses: 14, trees: 10, treeKind: 'momiji', plate: '#c9ae78' },
};

export interface CityProps { id: string; kind: LandmarkKind; position: [number, number, number]; name: string; nameJa: string; dates?: string; selected: boolean; candidate?: boolean; onSelect: () => void }

export function City({ id, kind, position, name, nameJa, dates, selected: sel, candidate, onSelect }: CityProps) {
  const selected = sel && !candidate;
  const c = CFG[kind] ?? CFG.generic;
  const Lm = LANDMARKS[kind] ?? c.Lm;
  const inner = useRef<THREE.Group>(null!), ring = useRef<THREE.Mesh>(null!);
  const seed = useMemo(() => hashStr(id), [id]);
  const keep = c.keepOut, m = (h: string) => candidate ? mutedHex(h) : h;
  const wall = candidate ? (c.wall ?? WALLS).map(h => mutedHex(h)) : c.wall, roof = candidate ? (c.roof ?? ROOFS).map(h => mutedHex(h)) : c.roof;
  const houses = candidate ? Math.ceil(c.houses / 2) : c.houses, trees = candidate ? Math.ceil(c.trees / 2) : c.trees;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    inner.current.position.y = selected ? Math.abs(Math.sin(t * 2.2)) * 0.14 : 0;
    ring.current.visible = selected;
    if (selected) { const s = 1 + Math.sin(t * 3) * 0.03; ring.current.scale.set(s, s, 1); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 3) * 0.25; }
  });
  const click = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); onSelect(); };
  return (
    <group position={position} scale={candidate ? CANDIDATE_SCALE : 1}>
      <group ref={inner} onClick={click} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        {/* ground plate */}
        <mesh position={[0, PLATE_Y / 2, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[R, R + 0.15, PLATE_Y, 28]} /><primitive object={toonMat(m(c.plate))} attach="material" />
          <Outlined thickness={OUTLINE.thickness * (candidate ? 1 : 1.3)} color={OUTLINE.color} />
        </mesh>
        {/* soft blend ring where the plate meets the ground */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={toonMat(m('#a9a553'))}><ringGeometry args={[R + 0.1, R + 0.65, 40]} /></mesh>
        {/* crossing roads: kerb, surface, centre line */}
        {[0, Math.PI / 2].map((rot, i) => (
          <group key={rot} position={[0, PLATE_Y + 0.004 + i * 0.001, 0]} rotation={[-Math.PI / 2, 0, rot]}>
            <mesh material={toonMat(m('#8d7f66'))}><planeGeometry args={[R * 2 - 0.3, 0.62]} /></mesh>
            <mesh position={[0, 0, 0.002]} material={toonMat(m('#e6d8b4'))}><planeGeometry args={[R * 2 - 0.3, 0.5]} /></mesh>
            <mesh position={[0, 0, 0.004]} material={toonMat(m('#fff6dc'))}><planeGeometry args={[R * 2 - 0.9, 0.035]} /></mesh>
          </group>
        ))}
        <group position={[0, PLATE_Y, 0]}>
          <Scatter seed={seed} radius={R} clear={c.clear} houses={houses} trees={trees} treeKind={c.treeKind} wall={wall} roof={roof} keepOut={keep} />
          <Lm />
        </group>
      </group>
      <mesh ref={ring} position={[0, PLATE_Y + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[R + 0.2, R + 0.5, 48]} /><meshBasicMaterial color="#ffd666" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
