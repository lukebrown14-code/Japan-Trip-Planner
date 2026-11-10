import { useMemo } from 'react';
import * as THREE from 'three';
import { Outlines } from '@react-three/drei';
import { POLYS } from './geometry';
import { gradientMap } from '../toon';
import { useGrassMat } from './grassMaterial';
import { useStore } from '../../store';

const DEPTH = 0.6, BEVEL_T = 0.06, BEVEL_S = 0.05;
export const SEA_Y = -0.3;

export function Island() {
  const quality = useStore((s) => s.quality);
  const grass = useGrassMat(quality);
  const cliff = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color: '#8c5a3e', gradientMap: gradientMap() });
    // strata: horizontal rock bands, lighter near the rim, darker at the waterline
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float band = floor((vW.y + 0.9) * 5.0 + sin(vW.x*1.7 + vW.z*1.3) * 0.6);
  float v = fract(band * 0.618);
  diffuseColor.rgb *= 0.82 + 0.3 * smoothstep(-0.3, 0.5, vW.y) + (v - 0.5) * 0.14;
}`);
    };
    m.customProgramCacheKey = () => 'strataCliff';
    return [m];
  }, []);
  const geos = useMemo(() => POLYS.map((p) => {
    const shape = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL_S, bevelSegments: 2, curveSegments: 1, steps: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(DEPTH + BEVEL_T), 0);
    return g;
  }), []);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={[grass, cliff[0]]} receiveShadow>
          <Outlines thickness={0.06} color="#1b2a4a" />
        </mesh>
      ))}
    </group>
  );
}
