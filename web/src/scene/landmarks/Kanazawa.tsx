import { Box, Cyl, Ball, Roof } from '../city/parts';

/** Tsuzumi-mon: two lacquered timber pillars leaning to a lattice-roofed drum gate. */
function Gate() {
  const lean = 0.13;
  return <group position={[0, 0, -0.2]}>
    <Box p={[0, 0.06, 0]} s={[2.1, 0.12, 1.0]} c="#b9b2a3" />
    {[-1, 1].map(s => <group key={s}>
      <Cyl p={[s * 0.62, 1.05, 0]} r={[0, 0, -s * lean]} s={[0.12, 0.17, 1.9, 8]} c="#6b3f26" />
      <Cyl p={[s * 0.62, 0.2, 0]} s={[0.24, 0.26, 0.14, 8]} c="#8c8577" />
    </group>)}
    <Box p={[0, 1.95, 0]} s={[1.55, 0.14, 0.8]} c="#4b2d1c" />
    <Box p={[0, 2.05, 0]} s={[1.3, 0.04, 0.62]} c="#9fd0d8" outline={false} />
    <Roof p={[0, 2.02, 0]} w={1.5} d={0.8} h={0.1} c="#5b6a73" over={0.18} />
    <Box p={[0, 1.55, 0]} s={[1.0, 0.07, 0.1]} c="#6b3f26" />
  </group>;
}

/** Pine with yukitsuri: rope supports radiating from a central pole. */
function Pine() {
  return <group position={[1.1, 0, 0.7]}>
    <Cyl p={[0, 0.55, 0]} s={[0.07, 0.12, 1.1, 7]} c="#6a4a32" />
    <Cyl p={[0, 1.35, 0]} s={[0.012, 0.03, 1.0, 5]} c="#cdb88a" outline={false} />
    {[0.4, 0.75, 1.1].map((y, i) => <Ball key={i} p={[0, y + 0.1, 0]} rad={0.5 - i * 0.12} c="#2f6b3e" sc={[1.2, 0.45, 1.2]} />)}
    {Array.from({ length: 8 }, (_, i) => {
      const a = i / 8 * Math.PI * 2;
      return <Cyl key={i} p={[Math.cos(a) * 0.26, 0.9, Math.sin(a) * 0.26]} r={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} s={[0.008, 0.008, 1.0, 4]} c="#e0cfa0" outline={false} cast={false} />;
    })}
    <Ball p={[0, 0.12, 0]} rad={0.3} c="#f1f4f7" sc={[1.3, 0.3, 1.3]} />
  </group>;
}

export function Kanazawa() {
  return <group><Gate /><Pine /></group>;
}
