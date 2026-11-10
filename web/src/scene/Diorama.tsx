import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Terrain } from './Terrain'; import { Cities } from './Cities'; import { Transport } from './Transport'; import { CameraRig } from './CameraRig'; import { PresenceMarkers } from './Presence';
export function Diorama() {
  return (
    <Canvas className="stage" shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#bfe6f7']} />
      <OrthographicCamera makeDefault position={[60, 70, 60]} zoom={14} near={-500} far={500} />
      <Terrain /><Cities /><PresenceMarkers /><Transport /><CameraRig />
    </Canvas>
  );
}
