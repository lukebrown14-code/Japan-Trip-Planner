import { RANGES } from './ranges';
import { useMemo } from 'react';
import * as THREE from 'three';
import { Outlines } from '@react-three/drei';
import { toonMat } from '../toon';
import { toWorld } from '../../geo';
import { ToonInstances, type Inst } from './Instances';
import { rng, onLand } from './geometry';
import { useStore } from '../../store';

export const FUJI = { lat: 35.36, lng: 138.73 };
const ROCK = ['#9a7a58', '#7f8f5a', '#a8683c', '#7a8aa0', '#8a6f52'];

export function Mountains() {
  const quality = useStore((s) => s.quality);
  const { cones, caps, feet } = useMemo(() => {
    const r = rng(7);
    const cones: Inst[] = [], caps: Inst[] = [], feet: Inst[] = [];
    for (const rg of RANGES) {
      const count = Math.round(rg.n * (quality === 'low' ? 0.6 : 1));
      for (let i = 0; i < count; i++) {
        const f = r() * (rg.pts.length - 1), k = Math.min(rg.pts.length - 2, Math.floor(f)), u = f - k;
        const a = rg.pts[k], b = rg.pts[k + 1];
        const [x, z] = toWorld(a[0] + (b[0] - a[0]) * u + (r() - 0.5) * rg.w * 0.2, a[1] + (b[1] - a[1]) * u + (r() - 0.5) * rg.w * 0.2);
        const jx = x + (r() - 0.5) * rg.w * 4, jz = z + (r() - 0.5) * rg.w * 4;
        if (!onLand(jx, jz)) continue;
        const h = rg.h * (0.5 + r() * 0.7), rad = h * (0.42 + r() * 0.2);
        const c = new THREE.Color(ROCK[Math.floor(r() * ROCK.length)]);
        // low skirt hides the cone/ground seam
        feet.push({ p: [jx, 0.1, jz], s: [rad * 1.55, 0.22, rad * 1.55], ry: r() * 6, color: c.clone().lerp(new THREE.Color('#a9a553'), 0.55) });
        cones.push({ p: [jx, h / 2, jz], s: [rad, h, rad], ry: r() * 6, color: c });
        if (h > 1.3) caps.push({ p: [jx, h * 0.82, jz], s: [rad * 0.38, h * 0.36, rad * 0.38], ry: 0 });
      }
    }
    return { cones, caps, feet };
  }, [quality]);
  const cone = useMemo(() => new THREE.ConeGeometry(1, 1, 6, 1), []);
  const skirt = useMemo(() => new THREE.ConeGeometry(1, 1, 14, 1), []);
  return (
    <group>
      <ToonInstances geometry={skirt} items={feet} flat />
      <ToonInstances geometry={cone} items={cones} outline={0.07} flat castShadow />
      <ToonInstances geometry={cone} items={caps.map((c) => ({ ...c, p: [c.p[0], c.p[1] + 0.02, c.p[2]] as [number, number, number], s: [c.s[0] * 1.04, c.s[1], c.s[2] * 1.04] as [number, number, number], color: new THREE.Color('#fbfdff') }))} outline={0.05} flat />
      <Fuji />
    </group>
  );
}

function Fuji() {
  const [x, z] = toWorld(FUJI.lat, FUJI.lng);
  const H = 3.6, R = 2.3;
  const cap = useMemo(() => {
    const capFrac = 0.4;
    const g = new THREE.ConeGeometry(R * capFrac * 1.015, H * capFrac * 1.0, 18, 1, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 0) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) - (0.5 + 0.5 * Math.sin(a * 5 + 1)) * 0.5 - (Math.sin(a * 11) * 0.5 + 0.5) * 0.18); }
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, H / 2, 0]} material={toonMat('#6a79b8')} castShadow receiveShadow>
        <coneGeometry args={[R, H, 24, 1]} />
        <Outlines thickness={0.05} color="#1b2a4a" />
      </mesh>
      <mesh position={[0, H * (1 - 0.2), 0]} material={toonMat('#ffffff')} castShadow>
        <primitive object={cap} attach="geometry" />
        <Outlines thickness={0.03} color="#1b2a4a" />
      </mesh>
      {/* lower autumn foothills ring */}
      <mesh position={[0, 0.28, 0]} material={toonMat('#c0642c')}>
        <coneGeometry args={[R * 1.12, 0.6, 24, 1]} />
        <Outlines thickness={0.04} color="#1b2a4a" />
      </mesh>
    </group>
  );
}
