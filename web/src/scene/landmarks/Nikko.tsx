import { toonMat } from '../toon';
import { useMemo } from 'react';
import { Box, Cyl, Roof } from '../city/parts';

function Bridge() {
  // red arched Shinkyo bridge across the stream (stream runs along X, bridge along Z)
  const segs = 11, rise = 0.55, len = 1.9;
  const parts = useMemo(() => Array.from({ length: segs }, (_, i) => {
    const t = (i + 0.5) / segs, z = (t - 0.5) * len, y = Math.sin(t * Math.PI) * rise;
    const dydz = Math.cos(t * Math.PI) * Math.PI * rise / len;
    return { z, y, rx: Math.atan(dydz) };
  }), []);
  return <group position={[0, 0, 0.0]}>
    {parts.map((s, i) => <group key={i} position={[0, s.y + 0.1, s.z]} rotation={[s.rx, 0, 0]}>
      <Box s={[0.5, 0.07, len / segs * 1.12]} c="#c8302a" />
      <Box p={[0.27, 0.16, 0]} s={[0.04, 0.2, len / segs * 1.05]} c="#e0432e" outline={false} />
      <Box p={[-0.27, 0.16, 0]} s={[0.04, 0.2, len / segs * 1.05]} c="#e0432e" outline={false} />
    </group>)}
    <Box p={[0, 0.5, -0.95]} s={[0.55, 0.2, 0.15]} c="#8a2c1c" /><Box p={[0, 0.5, 0.95]} s={[0.55, 0.2, 0.15]} c="#8a2c1c" />
    {[-0.25, 0.25].map(x => <Cyl key={x} p={[x, 0.2, 0]} s={[0.05, 0.05, 0.6, 8]} c="#7a3b34" />)}
  </group>;
}

function Gate() {
  // Yomeimon-style gate
  return <group position={[0, 0, -2.0]}>
    {[0, 1, 2].map(i => <Box key={i} p={[0, 0.05 + i * 0.06, 0.5 - i * 0.12]} s={[0.9, 0.1, 0.2]} c="#b9b2a3" />)}
    <Box p={[0, 0.5, 0]} s={[1.2, 0.7, 0.55]} c="#f4ecd8" />
    {[-0.5, -0.17, 0.17, 0.5].map(x => <Cyl key={x} p={[x, 0.45, 0.3]} s={[0.07, 0.07, 0.85, 8]} c="#c8302a" />)}
    <Box p={[0, 0.88, 0.3]} s={[1.2, 0.1, 0.12]} c="#e5b53c" />
    <Roof p={[0, 0.85, 0]} w={1.2} d={0.6} h={0.4} c="#2c3a46" over={0.2} />
    <Box p={[0, 1.28, 0]} s={[0.9, 0.3, 0.45]} c="#f4ecd8" />
    <Roof p={[0, 1.42, 0]} w={0.9} d={0.45} h={0.35} c="#2c3a46" over={0.2} />
    <Box p={[0, 1.36, 0.25]} s={[0.5, 0.1, 0.03]} c="#e5b53c" outline={false} />
  </group>;
}

export function Nikko() {
  return <group>
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6.2, 0.9]} /><primitive object={toonMat('#59b8d6')} attach="material" /></mesh>
    <Bridge /><Gate />
  </group>;
}
