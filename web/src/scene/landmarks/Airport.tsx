import { Box, Glow } from '../city/parts';
import { toonMat } from '../toon';
/** Haneda: terminal, tower and a short runway. ~7 units wide. */
export function Airport() {
  return <group>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[7, 7]} /><primitive object={toonMat("#a9c78a")} attach="material" /></mesh>
    {/* runway */}
    <group position={[0, 0.06, 1.8]}>
      <Box p={[0, 0, 0]} s={[6.4, 0.08, 0.9]} c="#4a4f5c" outline={false} cast={false} />
      {Array.from({ length: 9 }, (_, i) => <Box key={i} p={[-2.8 + i * 0.7, 0.05, 0]} s={[0.35, 0.02, 0.06]} c="#f4f0e0" outline={false} cast={false} />)}
      {Array.from({ length: 12 }, (_, i) => <Glow key={i} p={[-3 + i * 0.55, 0.06, 0.5]} s={[0.05, 0.05, 0.05]} c="#ffd27a" />)}
    </group>
    {/* terminal */}
    <group position={[0, 0, -1.0]}>
      <Box p={[0, 0.3, 0]} s={[3.6, 0.6, 1.0]} c="#e6edf4" />
      <Box p={[0, 0.34, 0.51]} s={[3.3, 0.28, 0.02]} c="#6bb5d9" outline={false} />
      <Box p={[0, 0.66, 0]} s={[3.8, 0.1, 1.2]} c="#3d4a6b" />
      <Box p={[-1.6, 0.4, 0.9]} s={[0.5, 0.2, 0.6]} c="#e6edf4" />
    </group>
    {/* control tower */}
    <group position={[2.4, 0, -1.2]}>
      <Box p={[0, 0.7, 0]} s={[0.2, 1.4, 0.2]} c="#e6edf4" />
      <Box p={[0, 1.5, 0]} s={[0.5, 0.25, 0.5]} c="#6bb5d9" />
      <Box p={[0, 1.7, 0]} s={[0.6, 0.06, 0.6]} c="#3d4a6b" />
    </group>
  </group>;
}
