import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { rng } from './geometry';
import { rig } from './rigState';
import { sunLive } from './sun';

const COLS = ['#d9391f', '#f08a24', '#f5c628', '#b3261e', '#e8671f'];

/** Autumn falling leaves, volume follows the camera target. */
export function Leaves() {
  const quality = useStore((s) => s.quality);
  const N = quality === 'low' ? 70 : 260;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const seeds = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: N }, () => ({ x: r(), z: r(), y: r(), sp: 0.5 + r() * 0.6, ph: r() * 6.28, sz: 0.7 + r() * 0.6, rs: 1 + r() * 2 }));
  }, [N]);
  const geo = useMemo(() => {
    // leaf-shaped (momiji-ish diamond) plane
    const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(0.28, 0.1); s.lineTo(0.18, -0.1); s.lineTo(0, -0.5); s.lineTo(-0.18, -0.1); s.lineTo(-0.28, 0.1); s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), []);
  useLayoutEffect(() => { seeds.forEach((_, i) => ref.current.setColorAt(i, new THREE.Color(COLS[i % COLS.length]))); ref.current.instanceColor!.needsUpdate = true; }, [seeds]);
  const d = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1);
    const span = Math.min(90, Math.max(18, (rig.viewW / rig.zoom) * 1.1));
    const H = 22;
    const size = Math.min(1.1, Math.max(0.14, 4.2 / rig.zoom));
    mat.opacity = 0.35 + 0.65 * sunLive.info.day * 0.8 + 0.2;
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const y = H - ((s.y * H + t.current * s.sp * 1.6) % H);
      const x = rig.tx + (s.x - 0.5) * span + Math.sin(t.current * 0.8 + s.ph) * 1.2 + y * 0.15;
      const z = rig.tz + (s.z - 0.5) * span + Math.cos(t.current * 0.6 + s.ph) * 1.2;
      d.position.set(x, y + 0.3, z);
      d.rotation.set(t.current * s.rs + s.ph, t.current * s.rs * 0.7, Math.sin(t.current + s.ph) * 1.2);
      d.scale.setScalar(size * s.sz);
      d.updateMatrix(); ref.current.setMatrixAt(i, d.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh key={N} ref={ref} args={[geo, mat, N]} frustumCulled={false} renderOrder={5} />;
}
