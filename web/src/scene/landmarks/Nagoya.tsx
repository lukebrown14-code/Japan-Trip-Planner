import { Box, Roof } from '../city/parts';

function Shachi({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  // golden tiger-headed carp, tail curling up
  return <group position={p} scale={s}>
    <Box p={[0, 0.1, 0]} s={[0.08, 0.2, 0.12]} c="#e5b53c" />
    <Box p={[0, 0.26, 0.03]} s={[0.07, 0.16, 0.1]} r={[-0.5, 0, 0]} c="#e5b53c" />
    <Box p={[0, 0.38, 0.1]} s={[0.06, 0.1, 0.08]} r={[-1.0, 0, 0]} c="#f2cc55" />
  </group>;
}

export function Nagoya() {
  const tiers = [
    { w: 1.5, y: 0.5, h: 0.5 },
    { w: 1.15, y: 1.15, h: 0.4 },
    { w: 0.8, y: 1.65, h: 0.36 },
  ];
  return <group>
    <Box p={[0, 0.2, 0]} s={[2.0, 0.4, 2.0]} c="#9a9585" />
    <Box p={[0, 0.42, 0]} s={[1.7, 0.06, 1.7]} c="#7a7568" />
    {tiers.map((t, i) => <group key={i}>
      <Box p={[0, t.y + t.h / 2, 0]} s={[t.w, t.h, t.w]} c="#f1ede2" />
      <Box p={[0, t.y + t.h * 0.55, t.w / 2 + 0.01]} s={[t.w * 0.5, t.h * 0.3, 0.02]} c="#3a3a40" outline={false} />
      <Roof p={[0, t.y + t.h, 0]} w={t.w} d={t.w} h={0.3} c="#3f8f7a" over={0.2} />
    </group>)}
    <Box p={[0, 2.38, 0]} s={[0.55, 0.05, 0.06]} c="#3f8f7a" />
    <Shachi p={[-0.3, 2.35, 0]} s={1.2} />
    <Shachi p={[0.3, 2.35, 0]} s={1.2} />
    <Box p={[1.3, 0.2, 1.25]} s={[0.6, 0.4, 0.4]} c="#f1ede2" />
    <Roof p={[1.3, 0.4, 1.25]} w={0.6} d={0.4} h={0.22} c="#3f8f7a" over={0.12} />
  </group>;
}
