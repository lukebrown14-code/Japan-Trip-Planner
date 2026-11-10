// OWNED BY: Collaboration agent. Mount <PresenceMarkers/> inside the Canvas (e.g. in Diorama next to <Cities/>).
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef } from 'react';
import { useStore } from '../store';
import { toWorld } from '../geo';
import { personColor, initial } from '../ui/collab/people';

function makeTex(name: string, color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = color; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.font = '700 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initial(name), 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function Marker({ name, pos, index }: { name: string; pos: [number, number, number]; index: number }) {
  const travellers = useStore(s => s.travellers);
  const tex = useMemo(() => makeTex(name, personColor(name, travellers)), [name, travellers]);
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 2 + index) * 0.15; });
  return <sprite ref={ref} position={pos} scale={[1.3, 1.3, 1]} renderOrder={999}><spriteMaterial map={tex} depthTest={false} transparent /></sprite>;
}
export function PresenceMarkers() {
  const online = useStore(s => s.online), me = useStore(s => s.me), stops = useStore(s => s.data.stops);
  const others = online.filter(u => u.name !== me && u.stopId);
  return <group>{others.map((u, i) => {
    const s = stops.find(x => x.id === u.stopId); if (!s) return null;
    const [x, z] = toWorld(s.lat, s.lng); const same = others.filter((o, j) => j < i && o.stopId === u.stopId).length;
    return <Marker key={u.name} name={u.name} index={i} pos={[x + same * 1.4, 5.5, z]} />;
  })}</group>;
}
