import { Box, Cyl } from '../city/parts';

export function Fukuoka() {
  return <group>
    {/* Fukuoka Tower: slim triangular mirrored tower */}
    <Cyl p={[0, 0.06, -0.5]} s={[0.5, 0.55, 0.12, 3]} c="#b9b2a3" />
    <Cyl p={[0, 0.8, -0.5]} s={[0.22, 0.36, 1.5, 3]} c="#9fc4de" />
    <Cyl p={[0, 1.7, -0.5]} s={[0.1, 0.22, 0.3, 3]} c="#7fa7c4" />
    <Cyl p={[0, 2.0, -0.5]} s={[0.02, 0.1, 0.3, 3]} c="#e7edf2" />
    {/* canal */}
    <mesh position={[0.1, 0.02, 0.7]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.6, 0.5]} /><meshBasicMaterial color="#5aa0c4" /></mesh>
    {/* low canal-side buildings */}
    {[-1.3, -0.5, 0.4, 1.2].map((x, i) => <group key={x}>
      <Box p={[x, 0.2, 0.25]} s={[0.6, 0.4 + (i % 2) * 0.12, 0.35]} c={['#e8d7b5', '#d6b9a0', '#c9d3d9', '#ead9c0'][i]} />
      <Box p={[x, 0.42 + (i % 2) * 0.12, 0.25]} s={[0.66, 0.05, 0.4]} c="#6a5a52" />
    </group>)}
    {[-0.9, 0.0, 0.8].map((x, i) => <Box key={x} p={[x, 0.17, 1.15]} s={[0.5, 0.3 + (i % 2) * 0.1, 0.3]} c={['#d6b9a0', '#ead9c0', '#c9d3d9'][i]} />)}
  </group>;
}
