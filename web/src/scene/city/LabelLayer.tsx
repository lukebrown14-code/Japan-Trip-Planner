import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { toWorld } from '../../geo';
import { CITIES } from '../../data/cities';
import { CANDIDATE_SCALE, isOnRoute } from './candidate';
import { LABEL_Y } from './City';

/** Screen positions (canvas px) per stop id, written every frame by <LabelProjector/>, read by <LabelOverlay/>. */
export const labelPos: Record<string, { x: number; y: number; vis: boolean }> = {};
const v = new THREE.Vector3();
if (typeof window !== 'undefined') (window as unknown as { __labelPos: unknown }).__labelPos = labelPos; // debug/screenshot hook

export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    const stops = useStore.getState().data.stops;
    for (const c of Object.values(CITIES)) {
      if (isOnRoute(c.key, stops)) { delete labelPos['cand:' + c.key]; continue; }
      const [x, z] = toWorld(c.lat, c.lng); v.set(x, (LABEL_Y[c.landmark] ?? 3.2) * CANDIDATE_SCALE, z).project(camera);
      labelPos['cand:' + c.key] = { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, vis: v.z < 1 && v.z > -1 };
    }
    for (const s of stops) {
      const [x, z] = toWorld(s.lat, s.lng);
      v.set(x, LABEL_Y[CITIES[s.cityKey]?.landmark ?? 'generic'] ?? 3.2, z).project(camera);
      labelPos[s.id] = { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, vis: v.z < 1 && v.z > -1 };
    }
  });
  return null;
}
