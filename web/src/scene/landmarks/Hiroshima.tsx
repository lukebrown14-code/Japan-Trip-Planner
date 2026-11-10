import { Box, Cyl, Torii } from '../city/parts';

export function Hiroshima() {
  return <group>
    {/* A-bomb Dome: boxy building, ruined dome frame */}
    <group position={[0, 0, -0.3]}>
      <Box p={[0, 0.06, 0]} s={[1.6, 0.12, 1.2]} c="#b9b2a3" />
      <Box p={[0, 0.5, 0]} s={[1.2, 0.76, 0.8]} c="#d9d0bf" />
      <Box p={[0, 0.55, 0.41]} s={[0.9, 0.3, 0.02]} c="#6b6f78" outline={false} />
      <Box p={[0, 0.3, 0.41]} s={[0.9, 0.3, 0.02]} c="#6b6f78" outline={false} />
      <Box p={[0, 0.98, 0]} s={[0.6, 0.2, 0.6]} c="#cfc6b3" />
      <Cyl p={[0, 1.18, 0]} s={[0.3, 0.3, 0.2, 14]} c="#cfc6b3" />
      {/* bare dome ribs */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI;
        return <Box key={i} p={[0, 1.5, 0]} s={[0.02, 0.5, 0.02]} r={[0, a, 0]} c="#5f6a66" outline={false} />;
      })}
      <mesh position={[0, 1.38, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.015, 5, 16]} /><meshBasicMaterial color="#5f6a66" /></mesh>
    </group>
    {/* peace flame + torii */}
    <Cyl p={[0.95, 0.06, 0.9]} s={[0.16, 0.2, 0.12, 10]} c="#a9a597" />
    <mesh position={[0.95, 0.22, 0.9]}><coneGeometry args={[0.07, 0.2, 6]} /><meshBasicMaterial color="#ff9a2e" /></mesh>
    <Torii p={[-0.9, 0, 1.0]} h={0.7} />
  </group>;
}
