import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../../store';
import { legRoute } from './routes';
import { VehicleModel, TAIL } from './Vehicles';
import { SpeedLines } from './Effects';

const S = 0.42;
/** World units per second along the route. */
const SPEED = 1.2;

/** A single shinkansen running back and forth along the rail route through every stop, forever. */
export function ActiveVehicle() {
  const root = useRef<THREE.Group>(null!);
  const speed = useRef(1);
  const stops = useStore(s => s.data.stops);
  const routes = useMemo(() => {
    const keys = [...stops].sort((a, b) => a.ord - b.ord).map(s => s.cityKey).filter((k, i, a) => i === 0 || k !== a[i - 1]);
    const out: THREE.CurvePath<THREE.Vector3>[] = [];
    for (let i = 0; i < keys.length - 1; i++) out.push(legRoute(keys[i], keys[i + 1]).path);
    return out;
  }, [stops]);
  const total = useMemo(() => routes.reduce((n, r) => n + r.getLength(), 0), [routes]);
  const dist = useRef(0);

  useFrame((_, dtRaw) => {
    const g = root.current; if (!g || !routes.length) return;
    dist.current += Math.min(dtRaw, 0.1) * SPEED;
    // ping-pong: 0..total..0
    const m = dist.current % (2 * total); const forward = m <= total; let d = forward ? m : 2 * total - m;
    let r = 0; while (r < routes.length - 1 && d > routes[r].getLength()) { d -= routes[r].getLength(); r++; }
    const path = routes[r]; const u = Math.min(1, Math.max(0, d / path.getLength()));
    const p = path.getPointAt(u), t = path.getTangentAt(u);
    const sign = forward ? 1 : -1;
    g.position.copy(p); g.rotation.set(0, Math.atan2(-t.z * sign, t.x * sign), 0);
  });

  if (!routes.length) return null;
  return (
    <group ref={root} scale={S}>
      <VehicleModel />
      <SpeedLines speed={speed} tail={TAIL} spread={1.3} />
    </group>
  );
}
