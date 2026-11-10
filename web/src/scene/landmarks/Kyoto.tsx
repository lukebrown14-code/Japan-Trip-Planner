import { toonMat } from '../toon';
import { Box, Cyl, Roof, Torii } from '../city/parts';

function Pagoda() {
  // Yasaka pagoda: five tiers
  const tiers = [0, 1, 2, 3, 4];
  return <group position={[-0.4, 0, -0.9]}>
    <Box p={[0, 0.06, 0]} s={[1.3, 0.12, 1.3]} c="#b9b2a3" />
    {tiers.map(i => {
      const w = 0.78 - i * 0.1, y = 0.12 + i * 0.62;
      return <group key={i}>
        <Box p={[0, y + 0.22, 0]} s={[w, 0.44, w]} c={i === 0 ? '#e8d7b5' : '#c9a66b'} />
        <Box p={[0, y + 0.22, w / 2 + 0.01]} s={[w * 0.3, 0.3, 0.02]} c="#8a2c1c" outline={false} />
        <Roof p={[0, y + 0.44, 0]} w={w} d={w} h={0.18} c="#4a4d58" over={0.28 - i * 0.02} />
      </group>;
    })}
    <Cyl p={[0, 3.45, 0]} s={[0.02, 0.04, 0.9, 6]} c="#e5b53c" />
    {[0, 1, 2].map(i => <Cyl key={i} p={[0, 3.1 + i * 0.22, 0]} s={[0.09 - i * 0.015, 0.09 - i * 0.015, 0.035, 10]} c="#e5b53c" outline={false} />)}
  </group>;
}

export function Kyoto() {
  return <group>
    <Pagoda />
    {/* Fushimi-style torii path heading away to the front-right */}
    <group position={[0.7, 0, 0.3]} rotation={[0, 0.67, 0]}>
      <mesh position={[0, 0.02, 1.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.5, 3.4]} /><primitive object={toonMat('#cdb68a')} attach="material" /></mesh>
      {Array.from({ length: 12 }, (_, i) => <Torii key={i} p={[0, 0, i * 0.26]} h={0.58 - i * 0.012} />)}
    </group>
    {/* small machiya hall */}
    <Box p={[1.2, 0.25, -1.1]} s={[0.9, 0.5, 0.6]} c="#e8d7b5" /><Roof p={[1.2, 0.5, -1.1]} w={0.9} d={0.6} h={0.3} c="#4a4d58" over={0.15} />
  </group>;
}
