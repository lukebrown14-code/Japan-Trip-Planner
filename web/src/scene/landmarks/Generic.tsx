import { toonMat } from '../toon';
import { Box, Roof, Torii, Cyl } from '../city/parts';
export function Generic() {
  return <group>
    <Torii p={[0, 0, 0.9]} h={0.8} />
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.45, 2.4]} /><primitive object={toonMat('#cdb68a')} attach="material" /></mesh>
    <group position={[0, 0, -0.5]}>
      <Box p={[0, 0.07, 0]} s={[1.3, 0.14, 1]} c="#b9b2a3" />
      <Box p={[0, 0.4, 0]} s={[0.9, 0.5, 0.65]} c="#f4ecd8" />
      {[-0.4, 0.4].map(x => <Cyl key={x} p={[x, 0.4, 0.33]} s={[0.04, 0.04, 0.5, 8]} c="#c8302a" />)}
      <Roof p={[0, 0.65, 0]} w={0.9} d={0.65} h={0.45} c="#3d4a6b" over={0.22} />
    </group>
  </group>;
}
