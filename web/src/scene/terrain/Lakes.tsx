import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '../../geo';
import { outwardNormals, type Pt } from './geometry';
import { sunLive } from './sun';

/** Land top sits at y=0 (see Island); the lake floats a hair above it, with polygonOffset to avoid z-fighting. */
const LAKE_Y = 0.025;

/** Lake Biwa outline [lat, lng], elongated N-S, wide north basin, pinched at the Biwako-ohashi narrows */
const BIWA: [number, number][] = [
  [35.52, 136.04], [35.50, 136.10], [35.45, 136.18], [35.38, 136.22], [35.30, 136.19], [35.24, 136.17],
  [35.17, 136.12], [35.10, 136.06], [35.12, 136.02], [35.19, 136.04], [35.26, 136.05], [35.33, 136.06], [35.39, 135.98], [35.46, 135.98],
];

export function Lakes() {
  const pts = useMemo<Pt[]>(() => BIWA.map(([la, ln]) => toWorld(la, ln)), []);
  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [pts]);
  const ring = useMemo(() => {
    const nrm = outwardNormals(pts), W = 0.22, pos: number[] = [], s: number[] = [], idx: number[] = [], n = pts.length;
    pts.forEach(([x, z], i) => { pos.push(x, 0, z, x + nrm[i][0] * W, 0, z + nrm[i][1] * W); s.push(0, 1); });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i * 2, i * 2 + 1, j * 2, j * 2, i * 2 + 1, j * 2 + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(s, 1));
    g.setIndex(idx);
    return g;
  }, [pts]);

  // same wave/toon-crest look as Sea
  const mat = useMemo(() => new THREE.ShaderMaterial({
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime, uNight; uniform vec3 uDeep, uLight;
void main(){
  vec2 p = vW.xz;
  float w = sin(p.x*0.9+uTime*0.6) + sin(p.y*1.2-uTime*0.5) + sin((p.x+p.y)*1.8+uTime*0.9)*0.7 + sin((p.x-p.y*0.7)*3.2-uTime*1.1)*0.4;
  float band = step(2.05, w), band2 = step(2.6, w);
  vec3 col = mix(uDeep, uLight, 0.25 + band*0.18 + band2*0.14);
  col += band2 * (1.-uNight) * 0.12;
  gl_FragColor = vec4(col, 1.);
}`,
  }), []);
  const shore = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uShallow: { value: new THREE.Color() }, uNight: { value: 0 } },
    vertexShader: `attribute float aS; varying float vS; void main(){ vS=aS; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vS; uniform float uNight; uniform vec3 uShallow;
void main(){
  float foam = 1. - step(0.28, vS);
  vec3 col = mix(uShallow, vec3(1.,1.,.98)*(1.-0.5*uNight), foam);
  gl_FragColor = vec4(col, foam*0.9 + (1.-foam)*0.45*(1.-vS));
}`,
  }), []);

  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const i = sunLive.info;
    mat.uniforms.uTime.value = t.current;
    mat.uniforms.uDeep.value.copy(i.seaDeep); mat.uniforms.uLight.value.copy(i.seaLight);
    mat.uniforms.uNight.value = i.night; shore.uniforms.uNight.value = i.night;
    shore.uniforms.uShallow.value.copy(i.seaLight).lerp(new THREE.Color('#9af0e0'), 0.5 * i.day);
  });

  return (
    <group>
      <mesh geometry={geo} material={mat} position-y={LAKE_Y} renderOrder={2} />
      <mesh geometry={ring} material={shore} position-y={LAKE_Y} renderOrder={3} />
    </group>
  );
}
