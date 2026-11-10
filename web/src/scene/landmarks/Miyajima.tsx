import { Box, Roof, Cyl, Torii } from '../city/parts';

export function Miyajima() {
  return <group>
    {/* water disc */}
    <mesh position={[0, 0.03, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.7, 32]} /><meshBasicMaterial color="#4f9fc4" /></mesh>
    <mesh position={[0, 0.035, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.45, 1.7, 32]} /><meshBasicMaterial color="#8cc9e0" /></mesh>
    {/* the floating torii, feet in water */}
    <Torii p={[0, 0.03, 0.9]} h={1.1} />
    {/* shrine pier */}
    <group position={[0, 0, -0.9]}>
      <Box p={[0, 0.1, 0.55]} s={[0.35, 0.05, 0.6]} c="#b98a55" />
      {[-0.2, 0.2].map(x => [0.3, 0.8].map(z => <Cyl key={`${x}${z}`} p={[x, 0.05, z]} s={[0.03, 0.03, 0.12, 6]} c="#c8302a" outline={false} />))}
      <Box p={[0, 0.2, 0]} s={[1.3, 0.1, 0.8]} c="#c8302a" />
      <Box p={[0, 0.42, 0]} s={[0.9, 0.34, 0.55]} c="#f4ecd8" />
      <Roof p={[0, 0.58, 0]} w={0.9} d={0.55} h={0.3} c="#3d4a6b" over={0.2} />
    </group>
  </group>;
}
