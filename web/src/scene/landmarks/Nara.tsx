import { Box, Roof, Cyl, Ball } from '../city/parts';

function Deer({ p, ry = 0 }: { p: [number, number, number]; ry?: number }) {
  return <group position={p} rotation={[0, ry, 0]}>
    <Box p={[0, 0.15, 0]} s={[0.2, 0.12, 0.1]} c="#b98a55" />
    <Box p={[0.13, 0.25, 0]} s={[0.07, 0.07, 0.07]} c="#c89a62" />
    {[[-0.07, -0.03], [-0.07, 0.03], [0.07, -0.03], [0.07, 0.03]].map(([x, z], i) =>
      <Cyl key={i} p={[x, 0.045, z]} s={[0.012, 0.012, 0.09, 5]} c="#8a6238" outline={false} />)}
  </group>;
}

export function Nara() {
  return <group>
    {/* Todai-ji Daibutsu-den: stepped base, wide double roof */}
    <group position={[0, 0, -0.4]}>
      <Box p={[0, 0.06, 0]} s={[2.2, 0.12, 1.4]} c="#b9b2a3" />
      <Box p={[0, 0.3, 0]} s={[1.8, 0.36, 1.05]} c="#e8d7b5" />
      <Roof p={[0, 0.48, 0]} w={1.8} d={1.05} h={0.28} c="#3f4350" over={0.2} />
      <Box p={[0, 0.8, 0]} s={[1.3, 0.34, 0.78]} c="#e8d7b5" />
      <Roof p={[0, 0.97, 0]} w={1.3} d={0.78} h={0.38} c="#3f4350" over={0.2} />
      <Box p={[0, 1.37, 0]} s={[0.04, 0.1, 0.04]} c="#e5b53c" outline={false} />
      {[-0.7, -0.35, 0, 0.35, 0.7].map(x => <Cyl key={x} p={[x, 0.3, 0.55]} s={[0.035, 0.035, 0.36, 6]} c="#c8302a" outline={false} />)}
    </group>
    {/* stone lantern + tree */}
    <Cyl p={[0.9, 0.12, 0.7]} s={[0.04, 0.05, 0.24, 6]} c="#a9a597" />
    <Box p={[0.9, 0.3, 0.7]} s={[0.14, 0.1, 0.14]} c="#a9a597" />
    <Cyl p={[-1.2, 0.2, 0.5]} s={[0.04, 0.05, 0.4, 6]} c="#6b4a2f" />
    <Ball p={[-1.2, 0.6, 0.5]} rad={0.3} c="#5d8f4a" sc={[1, 0.9, 1]} />
    <Deer p={[-0.4, 0, 0.8]} ry={0.5} />
    <Deer p={[0.3, 0, 1.1]} ry={-2.2} />
    <Deer p={[0.9, 0, 1.3]} ry={1.2} />
  </group>;
}
