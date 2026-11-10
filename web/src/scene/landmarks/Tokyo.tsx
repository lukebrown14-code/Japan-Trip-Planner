import { Box, Cyl, Glow } from '../city/parts';
import { rng, pick } from '../city/util';
import { useMemo } from 'react';

const NEON = ['#ff3d8b', '#35e0ff', '#ffd23d', '#a46bff', '#4dff9a'];
function Tower({ p, w, d, h, body, neon }: { p: [number, number, number]; w: number; d: number; h: number; body: string; neon: string }) {
  const bands = Math.max(2, Math.floor(h / 0.5));
  return <group position={p}>
    <Box p={[0, h / 2, 0]} s={[w, h, d]} c={body} />
    {Array.from({ length: bands }, (_, i) => <Glow key={i} p={[0, 0.3 + i * (h - 0.3) / bands, d / 2 + 0.012]} s={[w * 0.72, 0.1, 0.02]} c={i % 2 ? '#ffe9a8' : neon} />)}
    {Array.from({ length: bands }, (_, i) => <Glow key={'s' + i} p={[w / 2 + 0.012, 0.3 + i * (h - 0.3) / bands, 0]} s={[0.02, 0.1, d * 0.72]} c={i % 2 ? neon : '#ffe9a8'} />)}
    <Glow p={[0, h + 0.04, 0]} s={[w * 0.5, 0.06, d * 0.5]} c={neon} />
  </group>;
}

export function Tokyo() {
  const towers = useMemo(() => {
    const r = rng(7); const out: { p: [number, number, number]; w: number; d: number; h: number; body: string; neon: string }[] = [];
    [[-1.9, -1.2], [-2.0, 0.9], [-1.1, 1.9], [1.7, 1.5], [2.0, -0.4], [1.4, -1.9], [-0.4, -2.2], [0.3, 2.2]].forEach(([x, z]) =>
      out.push({ p: [x, 0, z], w: 0.5 + r() * 0.3, d: 0.5 + r() * 0.3, h: 1.0 + r() * 1.5, body: pick(r, ['#5b6a8c', '#6f6a8f', '#4f5f80', '#7a7396']), neon: pick(r, NEON) }));
    return out;
  }, []);
  return <group>
    {towers.map((t, i) => <Tower key={i} {...t} />)}
    {/* Tokyo Skytree */}
    <group position={[0.2, 0, -0.1]}>
      <Cyl p={[0, 0.15, 0]} s={[0.42, 0.55, 0.3, 3]} c="#dfe8f2" r={[0, 0.5, 0]} />
      <Cyl p={[0, 1.4, 0]} s={[0.1, 0.3, 2.5, 3]} c="#e9f1fa" r={[0, 0.5, 0]} />
      <Cyl p={[0, 2.9, 0]} s={[0.09, 0.1, 1.0, 10]} c="#f2f6fb" />
      <Cyl p={[0, 2.35, 0]} s={[0.3, 0.2, 0.2, 14]} c="#cfe0f0" />
      <Glow p={[0, 2.35, 0]} s={[0.33, 0.045, 0.33]} c="#7fdcff" />
      <Cyl p={[0, 3.2, 0]} s={[0.24, 0.17, 0.18, 14]} c="#cfe0f0" />
      <Glow p={[0, 3.2, 0]} s={[0.26, 0.04, 0.26]} c="#7fdcff" />
      <Cyl p={[0, 3.9, 0]} s={[0.012, 0.045, 1.5, 6]} c="#f2f6fb" outline={false} />
      <Glow p={[0, 4.65, 0]} s={[0.05, 0.05, 0.05]} c="#ff4a4a" kind="ball" />
    </group>
    {/* Tokyo Tower hint */}
  </group>;
}
