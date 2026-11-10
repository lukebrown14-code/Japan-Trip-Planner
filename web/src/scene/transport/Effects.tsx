import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/** Anime speed streaks, child of the vehicle group (local units). `speed` ref 0..1. */
export function SpeedLines({ speed, tail, spread = 1.3 }: { speed: { current: number }; tail: number; spread?: number }) {
  const N = 9; const refs = useRef<(THREE.Mesh | null)[]>([]);
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ z: (Math.sin(i * 12.9) * 0.5) * spread * 2, y: 0.5 + ((i * 37) % 10) / 10 * 1.5, ph: (i * 0.37) % 1, len: 2.5 + (i % 3) * 1.2 })), [spread]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame(({ clock }) => {
    const sp = speed.current; mat.opacity = Math.min(0.75, sp * 0.9);
    seeds.forEach((s, i) => { const m = refs.current[i]; if (!m) return; const t = (clock.elapsedTime * 1.6 + s.ph) % 1; m.position.set(tail - 1 - t * 7, s.y, s.z); m.scale.set(s.len * (0.4 + sp), 1, 1); m.visible = sp > 0.03; });
  });
  return <>{seeds.map((_, i) => <mesh key={i} ref={el => { refs.current[i] = el; }} material={mat}><boxGeometry args={[1, 0.05, 0.05]} /></mesh>)}</>;
}

/** World-space puffs (exhaust / dust / contrail). Emits at `anchor` world position when moving. */
export function Puffs({ emit, color = '#ffffff', size = 0.08, life = 1.6, rise = 0.12 }: { emit: { current: THREE.Vector3 | null; rate: number }; color?: string; size?: number; life?: number; rise?: number }) {
  const N = 48; const ref = useRef<THREE.InstancedMesh>(null!);
  const st = useMemo(() => ({ age: new Float32Array(N).fill(99), pos: Array.from({ length: N }, () => new THREE.Vector3()), head: 0, acc: 0 }), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05);
    if (emit.current && emit.rate > 0) { st.acc += dt * emit.rate; while (st.acc > 1) { st.acc -= 1; const i = st.head++ % N; st.age[i] = 0; st.pos[i].copy(emit.current).add(new THREE.Vector3((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.03)); } }
    for (let i = 0; i < N; i++) {
      st.age[i] += dt; const t = st.age[i] / life; if (t >= 1) { d.scale.setScalar(0); } else { st.pos[i].y += rise * dt; d.position.copy(st.pos[i]); d.scale.setScalar(size * (0.5 + t * 1.8) * (1 - t * t)); }
      d.updateMatrix(); ref.current.setMatrixAt(i, d.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}><icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} /></instancedMesh>;
}
