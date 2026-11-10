import { toonMat } from '../toon';
import { Box, Cyl, Roof, Glow } from '../city/parts';

function Castle() {
  const tiers = [{ w: 1.2, h: 0.5 }, { w: 0.98, h: 0.42 }, { w: 0.78, h: 0.38 }, { w: 0.6, h: 0.34 }];
  let y = 0.75;
  return <group position={[-0.3, 0, -0.7]}>
    {/* stone base (truncated pyramid) */}
    <Cyl p={[0, 0.38, 0]} s={[0.95, 1.6, 0.75, 4]} r={[0, Math.PI / 4, 0]} c="#9aa1a8" />
    {tiers.map((t, i) => { const y0 = y; y += t.h + 0.1; return <group key={i}>
      <Box p={[0, y0 + t.h / 2, 0]} s={[t.w, t.h, t.w]} c="#f6f0e0" />
      <Box p={[0, y0 + t.h * 0.55, 0]} s={[t.w + 0.02, 0.06, t.w + 0.02]} c="#1f2c40" outline={false} />
      <Roof p={[0, y0 + t.h, 0]} w={t.w} d={t.w} h={0.22} c="#3f8f78" over={0.2} />
      <Box p={[0, y0 + t.h + 0.02, t.w / 2 + 0.1]} s={[0.3, 0.05, 0.06]} c="#e5b53c" outline={false} />
    </group>; })}
    <Roof p={[0, y, 0]} w={0.5} d={0.5} h={0.35} c="#3f8f78" over={0.18} />
    <Cyl p={[0, y + 0.45, 0]} s={[0.03, 0.05, 0.25, 6]} c="#e5b53c" />
    {/* moat */}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.45, 1.8, 28]} /><primitive object={toonMat('#59b8d6')} attach="material" /></mesh>
  </group>;
}

function Dotonbori() {
  const cols = ['#ff3d8b', '#35e0ff', '#ffd23d', '#a46bff', '#4dff9a', '#ff7a2a'];
  return <group position={[0, 0, 1.55]}>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 0.65]} /><primitive object={toonMat('#3d6e92')} attach="material" /></mesh>
    {[-1, 1].map(side => Array.from({ length: 6 }, (_, i) => {
      const x = -2.5 + i * 1.0 + (side > 0 ? 0.3 : 0), h = 0.8 + ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 0.2, c = cols[(i + (side > 0 ? 2 : 0)) % cols.length];
      return <group key={side + '_' + i} position={[x, 0, side * 0.62]}>
        <Box p={[0, h / 2, 0]} s={[0.8, h, 0.55]} c={side > 0 ? '#6a5f7e' : '#5b6a8c'} />
        <Glow p={[0, h * 0.7, -side * 0.285]} s={[0.62, 0.22, 0.02]} c={c} />
        <Glow p={[0, h * 0.3, -side * 0.285]} s={[0.5, 0.12, 0.02]} c={cols[(i + 3) % cols.length]} />
      </group>; }))}
    {/* Glico-man style billboard */}
    <group position={[-0.5, 0, -1.0]}><Box p={[0, 1.55, 0]} s={[0.9, 0.7, 0.1]} c="#2f6fd6" /><Glow p={[0, 1.55, 0.06]} s={[0.7, 0.5, 0.02]} c="#ffe34d" /><Box p={[0, 1.4, 0]} s={[0.1, 0.4, 0.1]} c="#2f6fd6" outline={false} /></group>
    {/* giant crab */}
    <group position={[1.3, 0, 1.0]}><Box p={[0, 1.2, 0]} s={[0.7, 0.35, 0.2]} c="#d6361f" /><Glow p={[0, 1.2, 0.11]} s={[0.5, 0.15, 0.02]} c="#ff8a5a" /></group>
  </group>;
}

export function Osaka() { return <group><Castle /><Dotonbori /></group>; }
