import { useMemo } from 'react';
import * as THREE from 'three';
import { Box, Gable, Cyl } from '../city/parts';
import { rng, pick } from '../city/util';
import { toonMat, OUTLINE, Outlined } from '../toon';

/** Dark-timber merchant house with lattice front. */
function Machiya({ p, w, d, ry = 0, seed }: { p: [number, number, number]; w: number; d: number; ry?: number; seed: number }) {
  const r = rng(seed); const h = 0.45 + r() * 0.12;
  return <group position={p} rotation={[0, ry, 0]}>
    <Box p={[0, h / 2, 0]} s={[w, h, d]} c={pick(r, ['#4a3226', '#3d2a22', '#55392a'])} />
    <Box p={[0, h * 0.35, d / 2 + 0.01]} s={[w * 0.8, h * 0.4, 0.02]} c="#e8c98a" outline={false} />
    <Box p={[0, h * 0.62, d / 2 + 0.05]} s={[w * 1.02, 0.04, 0.12]} c="#2a1c18" outline={false} />
    <Gable p={[0, h, 0]} w={w} d={d} h={0.3 + r() * 0.08} c={pick(r, ['#2d3139', '#3a3f47'])} />
  </group>;
}

function Alps() {
  const peaks = useMemo(() => { const r = rng(21); return Array.from({ length: 11 }, (_, i) => ({ x: -5.2 + i * 1.04 + (r() - 0.5) * 0.4, z: -3.4 - r() * 0.7, h: 1.6 + r() * 1.6, w: 1.1 + r() * 0.6 })); }, []);
  const snow = toonMat('#f4f8fc'), rock = toonMat('#7d8fb0');
  return <group>
    {peaks.map((k, i) => <group key={i} position={[k.x, 0, k.z]}>
      <mesh scale={[k.w, k.h, k.w]} position={[0, k.h / 2 - 0.2, 0]} castShadow><coneGeometry args={[1, 1, 6]} /><primitive object={rock} attach="material" /><Outlined thickness={OUTLINE.thickness} color={OUTLINE.color} /></mesh>
      <mesh scale={[k.w * 0.36, k.h * 0.34, k.w * 0.36]} position={[0, k.h * 0.83 - 0.2, 0]}><coneGeometry args={[1, 1, 6]} /><primitive object={snow} attach="material" /></mesh>
    </group>)}
  </group>;
}

export function Takayama() {
  const rows = useMemo(() => {
    const out: { p: [number, number, number]; w: number; d: number; ry: number; seed: number }[] = [];
    for (let i = 0; i < 6; i++) { const w = 0.55 + (i % 3) * 0.08; const x = -2.4 + i * 0.85;
      out.push({ p: [x, 0, -0.62], w, d: 0.7, ry: 0, seed: i + 1 }); out.push({ p: [x + 0.1, 0, 0.62], w: w * 0.95, d: 0.7, ry: Math.PI, seed: i + 30 }); }
    return out;
  }, []);
  return <group>
    <Alps />
    {rows.map((m, i) => <Machiya key={i} {...m} />)}
    {/* street */}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 0.8]} /><primitive object={toonMat('#8d7a5e')} attach="material" /></mesh>
    {/* little vermilion Nakabashi-style bridge + stream */}
    <mesh position={[1.9, 0.03, 0.0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.6, 6]} /><primitive object={toonMat('#59b8d6')} attach="material" /></mesh>
    <Box p={[1.9, 0.08, 0]} s={[0.7, 0.07, 0.8]} c="#c8302a" />
    {[-0.3, 0.3].map(z => <Box key={z} p={[1.9, 0.2, z]} s={[0.7, 0.12, 0.04]} c="#c8302a" outline={false} />)}
    {/* sugidama (cedar ball) sake sign */}
    <group position={[-2.6, 0, 0.0]}><Cyl p={[0, 0.4, 0]} s={[0.03, 0.03, 0.8, 6]} c="#4a3326" /><mesh position={[0, 0.9, 0]}><icosahedronGeometry args={[0.28, 1]} /><primitive object={toonMat('#3a6a40', { flatShading: true })} attach="material" /></mesh></group>
  </group>;
}
void THREE;
