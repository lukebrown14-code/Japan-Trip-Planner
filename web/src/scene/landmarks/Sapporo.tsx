import { Box, Cyl, Roof, Gable } from '../city/parts';

function ClockTower() {
  return <group position={[-0.5, 0, 0.3]}>
    <Box p={[0, 0.4, 0]} s={[1.7, 0.8, 0.9]} c="#f3f1ea" />
    <Gable p={[0, 0.8, 0]} w={1.7} d={0.9} h={0.35} c="#a7332a" over={0.06} />
    {[-0.55, -0.18, 0.18, 0.55].map(x => <Box key={x} p={[x, 0.42, 0.46]} s={[0.16, 0.3, 0.02]} c="#4a6b80" outline={false} />)}
    <Box p={[0, 1.2, 0]} s={[0.5, 0.5, 0.5]} c="#f3f1ea" />
    <Cyl p={[0, 1.22, 0.26]} r={[Math.PI / 2, 0, 0]} s={[0.17, 0.17, 0.03, 16]} c="#fffbe8" outline={false} />
    <Box p={[0, 1.26, 0.28]} s={[0.02, 0.1, 0.02]} c="#2a2230" outline={false} />
    <Box p={[0.03, 1.22, 0.28]} s={[0.07, 0.02, 0.02]} c="#2a2230" outline={false} />
    <Roof p={[0, 1.45, 0]} w={0.5} d={0.5} h={0.4} c="#a7332a" over={0.06} />
    <Cyl p={[0, 2.0, 0]} s={[0.01, 0.01, 0.3, 4]} c="#e5b53c" outline={false} />
  </group>;
}

function TvTower() {
  return <group position={[1.1, 0, -0.8]}>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) =>
      <Cyl key={i} p={[a * 0.1, 0.75, b * 0.1]} r={[b * 0.07, 0, -a * 0.07]} s={[0.025, 0.04, 1.5, 4]} c="#d9534a" />)}
    <Box p={[0, 0.5, 0]} s={[0.3, 0.03, 0.3]} c="#e8e8ea" />
    <Box p={[0, 1.4, 0]} s={[0.4, 0.14, 0.4]} c="#e8e8ea" />
    <Box p={[0, 1.55, 0]} s={[0.3, 0.12, 0.3]} c="#d9534a" />
    <Cyl p={[0, 2.2, 0]} s={[0.01, 0.03, 1.3, 5]} c="#d9534a" />
  </group>;
}

export function Sapporo() {
  return <group><ClockTower /><TvTower /></group>;
}
