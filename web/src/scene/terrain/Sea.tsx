import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POLYS, outwardNormals } from './geometry';
import { sunLive } from './sun';
import { SEA_Y } from './Island';
import { useStore } from '../../store';

const SEA_R = 260;
const SEA_CENTRE: [number, number] = [-6, 0];

export function Sea() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uC: { value: new THREE.Vector2(...SEA_CENTRE) }, uR: { value: SEA_R }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime, uR, uNight; uniform vec3 uDeep, uLight; uniform vec2 uC;
void main(){
  vec2 p = vW.xz;
  float w = sin(p.x*0.45+uTime*0.6) + sin(p.y*0.6-uTime*0.5) + sin((p.x+p.y)*0.9+uTime*0.9)*0.7 + sin((p.x-p.y*0.7)*1.6-uTime*1.1)*0.4;
  float band = step(2.05, w);              // toon highlight crests
  float band2 = step(2.6, w);
  vec3 col = mix(uDeep, uLight, band*0.18 + band2*0.14);
  col += band2 * (1.-uNight) * 0.12;
  float edge = 1. - smoothstep(uR*0.72, uR, length(p-uC));
  gl_FragColor = vec4(col, edge);
}`,
  }), []);

  const shore = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uShallow: { value: new THREE.Color() }, uNight: { value: 0 }, uHi: { value: 1 } },
    vertexShader: `attribute float aS; varying float vS; varying vec3 vW; void main(){ vS=aS; vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying float vS; varying vec3 vW; uniform float uTime, uNight, uHi; uniform vec3 uShallow;
void main(){
  float ph = vW.x*0.7 + vW.z*0.9;
  float sh = pow(1.-vS, 1.3) * 0.75;
  sh = floor(sh*4.+0.5)/4.;                 // stepped toon shallows
  float foam1 = 1. - step(0.10 + 0.035*sin(uTime*1.3+ph), vS);
  float c2 = 0.30 + 0.07*sin(uTime*0.8+ph*0.6);
  float foam2 = step(c2-0.012, vS) * (1.-step(c2+0.012, vS)) * 0.7 * uHi;
  float foam = max(foam1, foam2);
  // sandy beach band hugging the coast, fading to turquoise shallows
  vec3 sand = vec3(0.93, 0.84, 0.62) * (1.-0.45*uNight);
  float beach = 1. - step(0.2, vS);
  vec3 col = mix(uShallow, sand, beach * 0.85);
  col = mix(col, vec3(1.0, 1.0, 0.98) * (1.-0.5*uNight), foam);
  sh = max(sh, beach * 0.9);
  gl_FragColor = vec4(col, max(sh, foam*0.95));
}`,
  }), []);

  const rings = useMemo(() => POLYS.map((p) => {
    const nrm = outwardNormals(p);
    const W = 0.75;
    const pos: number[] = [], s: number[] = [], idx: number[] = [];
    p.forEach(([x, z], i) => {
      pos.push(x, SEA_Y + 0.02, z, x + nrm[i][0] * W, SEA_Y + 0.02, z + nrm[i][1] * W);
      s.push(0, 1);
    });
    const n = p.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i * 2, i * 2 + 1, j * 2, j * 2, i * 2 + 1, j * 2 + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(s, 1));
    g.setIndex(idx);
    return g;
  }), []);

  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const hi = useStore.getState().quality === 'high' ? 1 : 0;
    shore.uniforms.uHi.value = hi;
    const i = sunLive.info;
    mat.uniforms.uTime.value = t.current; shore.uniforms.uTime.value = t.current;
    mat.uniforms.uDeep.value.copy(i.seaDeep); mat.uniforms.uLight.value.copy(i.seaLight);
    mat.uniforms.uNight.value = i.night; shore.uniforms.uNight.value = i.night;
    shore.uniforms.uShallow.value.copy(i.seaLight).lerp(new THREE.Color('#9af0e0'), 0.5 * i.day);
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[SEA_CENTRE[0], SEA_Y, SEA_CENTRE[1]]} material={mat} renderOrder={-1}>
        <circleGeometry args={[SEA_R, 64]} />
      </mesh>
      {rings.map((g, i) => <mesh key={i} geometry={g} material={shore} renderOrder={1} />)}
    </group>
  );
}
