import { useMemo } from 'react';
import * as THREE from 'three';
import { ToonInstances, type Inst } from './Instances';
import { rng, onLandMargin } from './geometry';
import { toWorld } from '../../geo';
import { CITIES, AIRPORTS } from '../../data/cities';
import { useStore } from '../../store';
import { FUJI } from './Mountains';

const LEAF = ['#d9391f', '#f08a24', '#f5c628', '#b3261e', '#e8671f', '#f2b134'];
const CEDAR = ['#2f5d46', '#3d6b4a', '#2a5a52'];

export function Trees() {
  const quality = useStore((s) => s.quality);
  const { crowns, trunks, cedars } = useMemo(() => {
    const total = quality === 'low' ? 1100 : 3600;
    const r = rng(42);
    const avoid = [...Object.values(CITIES).map((c) => toWorld(c.lat, c.lng)), ...Object.values(AIRPORTS).map((c) => toWorld(c.lat, c.lng))];
    const fuji = toWorld(FUJI.lat, FUJI.lng);
    const crowns: Inst[] = [], trunks: Inst[] = [], cedars: Inst[] = [];
    // forest patches around random land points inside Japan's bbox
    let placed = 0, guard = 0;
    while (placed < total && guard++ < total * 40) {
      const cx = -85 + r() * 155, cz = -90 + r() * 150;
      if (!onLandMargin(cx, cz)) continue;
      const patch = 12 + Math.floor(r() * 30), rad = 0.5 + r() * 1.0;
      const cedarPatch = r() < 0.35;
      for (let i = 0; i < patch && placed < total; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * rad;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!onLandMargin(x, z, 0.12)) continue;
        if (avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < 0.9)) continue;
        if (Math.hypot(fuji[0] - x, fuji[1] - z) < 2.6) continue;
        const sc = 0.32 + r() * 0.3;
        if (cedarPatch || r() < 0.12) {
          cedars.push({ p: [x, sc * 0.7, z], s: [sc * 0.55, sc * 1.4, sc * 0.55], ry: r() * 6, color: new THREE.Color(CEDAR[Math.floor(r() * 3)]) });
        } else {
          trunks.push({ p: [x, sc * 0.25, z], s: [sc * 0.16, sc * 0.5, sc * 0.16] });
          crowns.push({ p: [x, sc * 0.78, z], s: [sc * 0.95, sc * 0.85, sc * 0.95], ry: r() * 6, color: new THREE.Color(LEAF[Math.floor(r() * LEAF.length)]) });
        }
        placed++;
      }
    }
    return { crowns, trunks, cedars };
  }, [quality]);
  const crownG = useMemo(() => new THREE.IcosahedronGeometry(0.5, 1), []);
  const trunkG = useMemo(() => new THREE.CylinderGeometry(0.6, 1, 1, 5), []);
  const cedarG = useMemo(() => new THREE.ConeGeometry(0.5, 1, 6), []);
  return (
    <group>
      <ToonInstances geometry={crownG} items={crowns} outline={0.07} />
      <ToonInstances geometry={trunkG} items={trunks} color="#6b4630" outline={0} />
      <ToonInstances geometry={cedarG} items={cedars} outline={0.08} />
    </group>
  );
}
