import { toonMat } from '../toon';
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Roof, Torii, Cyl } from '../city/parts';

function Steam() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => { if (!m) return; const t = ((clock.elapsedTime * 0.35 + i / 7) % 1);
      m.position.y = 0.15 + t * 1.3; m.position.x = Math.sin(t * 5 + i) * 0.1; m.scale.setScalar(0.1 + t * 0.2);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.55; });
  });
  return <group position={[0, 0.1, 0]}>{Array.from({ length: 7 }, (_, i) =>
    <mesh key={i} ref={m => { refs.current[i] = m; }}><icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} /></mesh>)}</group>;
}

export function Hakone() {
  return <group>
    {/* lake with a floating torii */}
    <mesh position={[0.9, 0.025, 0.9]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.5, 1, 1]}><circleGeometry args={[1.35, 28]} /><primitive object={toonMat('#4aa9d8')} attach="material" /></mesh>
    <mesh position={[0.9, 0.03, 0.9]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.5, 1, 1]}><ringGeometry args={[1.2, 1.35, 28]} /><primitive object={toonMat('#bfeaf7')} attach="material" /></mesh>
    <Torii p={[1.5, 0, 0.9]} h={0.9} r={[0, -1.1, 0]} outline />
    {/* onsen ryokan + steaming pool */}
    <group position={[-1.2, 0, -0.9]}>
      <Box p={[0, 0.3, 0]} s={[1.3, 0.6, 0.8]} c="#a9764a" />
      <Roof p={[0, 0.6, 0]} w={1.3} d={0.8} h={0.45} c="#5a3e3a" over={0.2} />
      <Box p={[0.35, 0.3, 0.41]} s={[0.3, 0.45, 0.02]} c="#f1e4c8" outline={false} />
      <group position={[1.15, 0, 0.3]}>
        <Cyl p={[0, 0.08, 0]} s={[0.55, 0.6, 0.16, 16]} c="#8c8f95" />
        <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.46, 18]} /><primitive object={toonMat('#9fe0e3')} attach="material" /></mesh>
        <Steam />
      </group>
    </group>
  </group>;
}
