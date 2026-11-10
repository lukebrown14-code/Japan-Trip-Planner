// Toon vehicle models. Local frame: forward = +x, up = +y, origin at rail-top centre. Units are ~10x world (apply scale 0.1).
import { useMemo, type ReactNode } from 'react';
import { Outlines } from '@react-three/drei';
import { toonMat, OUTLINE } from '../toon';

const OL = OUTLINE.thickness * 3; // local units (models are 10x)

interface PartProps { size: [number, number, number]; pos: [number, number, number]; color: string; rot?: [number, number, number]; outline?: boolean; shape?: 'box' | 'sphere' | 'cyl' | 'capsule'; emissive?: string; children?: ReactNode }
function Part({ size, pos, color, rot, outline = true, shape = 'box', emissive }: PartProps) {
  const mat = useMemo(() => toonMat(color, emissive ? { emissive, emissiveIntensity: 1 } : {}), [color, emissive]);
  return (
    <mesh position={pos} rotation={rot} material={mat} scale={shape === 'box' ? 1 : size} castShadow>
      {shape === 'box' && <boxGeometry args={size} />}
      {shape === 'sphere' && <sphereGeometry args={[0.5, 16, 12]} />}
      {shape === 'cyl' && <cylinderGeometry args={[0.5, 0.5, 1, 14]} />}
      {shape === 'capsule' && <capsuleGeometry args={[0.5, 1, 6, 14]} />}
      {outline && <Outlines thickness={OL} color={OUTLINE.color} />}
    </mesh>
  );
}
const WIN = '#2d3a5e';

function Bogies({ len, y = 0.18 }: { len: number; y?: number }) {
  return <>{[-1, 1].map(s => <Part key={s} size={[1.1, 0.3, 1.2]} pos={[s * len * 0.32, y, 0]} color="#3c3f55" outline={false} />)}</>;
}

/** N700-style: white, blue stripe, duck-bill nose. 3 cars. */
function Shinkansen() {
  const L = 4.6, W = 1.5, H = 1.45, GAP = 0.12, Y0 = 0.3;
  return (
    <group>
      {[-1, 0, 1].map(i => {
        const cx = i * (L + GAP);
        return (
          <group key={i} position={[cx, Y0, 0]}>
            <Part size={[L, H, W]} pos={[0, H / 2, 0]} color="#f6f8fb" />
            <Part size={[L - 0.4, 0.2, W * 0.7]} pos={[0, H + 0.08, 0]} color="#c9d3e0" outline={false} />
            <Part size={[L + 0.02, 0.2, W + 0.04]} pos={[0, 0.5, 0]} color="#1f5fb8" outline={false} />
            <Part size={[L - 0.6, 0.38, W + 0.04]} pos={[0, H * 0.68, 0]} color={WIN} outline={false} />
            <Part size={[L + 0.02, 0.06, W + 0.05]} pos={[0, 0.78, 0]} color="#1f5fb8" outline={false} />
            {Math.abs(i) === 1 && [1].map(() => {
              const f = Math.sign(i);
              return (
                <group key="nose" position={[f * (L / 2 - 0.05), 0, 0]} scale={[f, 1, 1]}>
                  <Part shape="sphere" size={[3.2, H * 1.9, W * 0.98]} pos={[0.2, H * 0.5, 0]} color="#f6f8fb" />
                  <Part size={[1.2, 0.55, W * 0.6]} pos={[1.4, 0.45, 0]} color="#f6f8fb" rot={[0, 0, -0.1]} />
                  <Part size={[0.9, 0.04, W * 0.62]} pos={[1.6, 0.74, 0]} color="#1f5fb8" outline={false} />
                  <Part size={[0.9, 0.42, W * 0.78]} pos={[0.55, H * 0.82, 0]} color={WIN} outline={false} rot={[0, 0, -0.25]} />
                  <Part shape="sphere" size={[0.22, 0.22, 0.22]} pos={[2.0, 0.55, 0.3]} color="#fff4a8" emissive="#ffe27a" outline={false} />
                  <Part shape="sphere" size={[0.22, 0.22, 0.22]} pos={[2.0, 0.55, -0.3]} color="#fff4a8" emissive="#ffe27a" outline={false} />
                </group>
              );
            })}
            <Bogies len={L} y={-0.05} />
          </group>
        );
      })}
    </group>
  );
}

export const VehicleModel = Shinkansen;
/** Approx half-length (local units) used to anchor effects at the tail. */
export const TAIL = -7.4;
