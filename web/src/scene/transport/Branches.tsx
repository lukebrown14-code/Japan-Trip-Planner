import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useStore } from '../../store';
import { toonMat } from '../toon';
import { toWorld } from '../../geo';
import { GROUND } from './routes';

export function dayTripSpurs(data: ReturnType<typeof useStore.getState>['data']) {
  const stops = new Map(data.stops.map(s => [s.id, s]));
  return data.activities.filter(a => a.kind === 'day_trip' && a.destLat != null && a.destLng != null && stops.has(a.stopId)).map(a => {
    const s = stops.get(a.stopId)!; const [x0, z0] = toWorld(s.lat, s.lng); const [x1, z1] = toWorld(a.destLat!, a.destLng!);
    return { id: a.id, name: a.destName ?? a.title, mode: a.mode ?? 'train', x0, z0, x1, z1 };
  });
}
const dummy = new THREE.Object3D();
const DASH_GEO = new THREE.BoxGeometry(0.09, 0.02, 0.045);

function Spur({ s }: { s: ReturnType<typeof dayTripSpurs>[number] }) {
  const dx = s.x1 - s.x0, dz = s.z1 - s.z0; const len = Math.hypot(dx, dz); const yaw = Math.atan2(-dz, dx);
  const n = Math.max(2, Math.floor(len / 0.16));
  const geo = DASH_GEO;
  const col = s.mode === 'bus' ? '#f2a65a' : '#7fc8a9';
  const ref = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; dummy.position.set(s.x0 + dx * t, GROUND + 0.03, s.z0 + dz * t); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
    m.instanceMatrix.needsUpdate = true;
  };
  return (
    <group>
      <instancedMesh ref={ref} args={[geo, toonMat(col, { emissive: col, emissiveIntensity: 0.35 }), n]} frustumCulled={false} />
      <group position={[s.x1, GROUND, s.z1]}>
        <mesh position={[0, 0.07, 0]} material={toonMat('#f4ead2')}><boxGeometry args={[0.2, 0.14, 0.16]} /></mesh>
        <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]} material={toonMat('#d9553b')}><coneGeometry args={[0.18, 0.12, 4]} /></mesh>
        <mesh position={[0.14, 0.14, 0.1]} material={toonMat('#6b4b32')}><cylinderGeometry args={[0.01, 0.01, 0.28, 6]} /></mesh>
        <Html position={[0, 0.5, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ font: '700 12px/1.15 var(--font-ui,"Zen Maru Gothic"),"Hiragino Sans","Noto Sans JP",system-ui,sans-serif', color: '#1b2a4a', background: 'linear-gradient(#f9ecd0,#e8cd9a)', border: '2px solid #1b2a4a', boxShadow: '0 2px 0 #1b2a4a', borderRadius: 8, padding: '2px 8px 3px', whiteSpace: 'nowrap', transform: 'translateY(-4px)' }}>
            {s.mode === 'bus' ? '🚌' : '🚃'} {s.name}
          </div>
        </Html>
      </group>
    </group>
  );
}

/** Dashed ground-level spurs from a stop to each day-trip destination. */
export function Branches() {
  const data = useStore(s => s.data);
  const spurs = useMemo(() => dayTripSpurs(data), [data]);
  return <>{spurs.map(s => <Spur key={s.id} s={s} />)}</>;
}
