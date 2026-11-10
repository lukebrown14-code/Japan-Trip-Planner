import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { sunLive } from './sun';
import { rig } from './rigState';
import { toonMat } from '../toon';

/** Screen-space gradient sky + sun/moon discs + stars. Drawn first; sea fades to transparent at its rim. */
function SkyQuad() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0.5, 0.5, 0) }, uMoon: { value: new THREE.Vector3(0.5, 0.5, 0) },
      uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uAsp: { value: 1 }, uT: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uTop, uHor, uSun, uMoon, uSunCol; uniform float uNight, uAsp, uT;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  float g = smoothstep(0.15, 1.0, vUv.y);
  vec3 col = mix(uHor, uTop, g);
  vec2 q = vec2(vUv.x*uAsp, vUv.y);
  // sun: hard anime disc + halo
  vec2 sp = vec2(uSun.x*uAsp, uSun.y); float d = distance(q, sp);
  col += uSunCol * exp(-d*5.0) * 0.35 * uSun.z;
  col = mix(col, uSunCol, (1.-smoothstep(0.045,0.05,d)) * uSun.z);
  // moon
  vec2 mp = vec2(uMoon.x*uAsp, uMoon.y); float md = distance(q, mp);
  col += vec3(0.6,0.7,1.0) * exp(-md*7.0) * 0.25 * uMoon.z;
  float disc = 1.-smoothstep(0.034,0.038,md);
  float crescent = 1.-smoothstep(0.030,0.034,distance(q, mp + vec2(0.016,0.008)));
  col = mix(col, vec3(1.0,0.97,0.82), clamp(disc - crescent*0.85,0.,1.) * uMoon.z);
  // stars
  vec2 c = floor(vUv*vec2(70.*uAsp,70.)); float r = h(c);
  vec2 f = fract(vUv*vec2(70.*uAsp,70.)) - 0.5 - (vec2(h(c+3.1),h(c+7.7))-0.5)*0.6;
  float star = step(0.93, r) * (1.-smoothstep(0.03,0.12,length(f))) * (0.6+0.4*sin(uT*2.+r*40.));
  col += vec3(1.,.97,.9) * star * uNight * smoothstep(0.3,0.8,vUv.y);
  gl_FragColor = vec4(col,1.0);
}`,
  }), []);
  const size = useThree((s) => s.size);
  useFrame(({ clock }) => {
    const i = sunLive.info;
    const u = mat.uniforms;
    u.uTop.value.copy(i.skyTop); u.uHor.value.copy(i.skyHorizon);
    u.uAsp.value = size.width / size.height; u.uT.value = clock.elapsedTime; u.uNight.value = i.night;
    // horizontal screen axis = camera right (cos yaw, -sin yaw) in world x/z
    const rx = Math.cos(rig.yaw), rz = -Math.sin(rig.yaw);
    const pos = (d: THREE.Vector3, alt: number) => {
      const hx = d.x, hz = d.z;
      return [0.5 + 0.38 * (hx * rx + hz * rz), 0.28 + 0.62 * Math.max(-0.3, alt) / 1.0] as const;
    };
    const s = pos(i.sunDir, i.sunDir.y * 1.2);
    u.uSun.value.set(s[0], s[1], THREE.MathUtils.smoothstep(i.sunDir.y, -0.12, 0.0) * (1 - 0.0));
    u.uSunCol.value.copy(i.altDeg < 12 ? i.lightColor : new THREE.Color('#fff4c8'));
    const m = pos(i.moonDir, i.moonDir.y * 1.0);
    u.uMoon.value.set(m[0], m[1], i.night);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Sun/moon driven lighting. Follows the camera target for shadows. */
function Lights() {
  const dir = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const quality = useStore((s) => s.quality);
  const tgt = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const info = sunLive.info; // fixed midday sun
    const L = dir.current, H = hemi.current;
    const useSun = info.altDeg > -3;
    const d = (useSun ? info.sunDir : info.moonDir).clone();
    if (useSun && d.y < 0.22) { d.y = 0.22; d.normalize(); }
    tgt.position.set(rig.tx, 0, rig.tz);
    L.position.set(rig.tx + d.x * 80, d.y * 80, rig.tz + d.z * 80);
    L.color.copy(info.lightColor); L.intensity = info.lightIntensity * (useSun ? 1 : 1);
    H.color.copy(info.skyHorizon).lerp(info.ambColor, 0.5); H.groundColor.copy(info.hemiGround); H.intensity = info.ambIntensity * 0.9;
    const half = Math.max(20, Math.min(90, rig.viewW / rig.zoom * 0.75));
    const c = L.shadow.camera;
    if (Math.abs(c.right - half) > 1) { c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.updateProjectionMatrix(); }
    L.castShadow = quality === 'high';
  });
  return (
    <>
      <primitive object={tgt} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={dir} target={tgt} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0008} shadow-normalBias={0.03} shadow-camera-near={1} shadow-camera-far={220} />
    </>
  );
}

const CLOUD_SPOTS: [number, number, number, number][] = [ // x, y, z, scale
  [-62, 10, -30, 1.3], [-48, 11, 22, 1.0], [-30, 12, -52, 1.2], [-20, 9, 40, 1.1], [0, 12, -62, 1.4], [14, 10, 52, 1.0],
  [30, 11, -36, 1.2], [46, 12, 10, 1.3], [58, 10, -50, 1.0], [-72, 11, 0, 1.2], [20, 13, 74, 1.1], [-8, 12, 80, 1.0],
];
const PUFFS: [number, number, number, number][] = [[0, 0, 0, 3.4], [3.2, -0.3, 0.8, 2.6], [-3.0, -0.4, -0.6, 2.4], [1.2, 1.2, -0.4, 2.4], [-1.2, 0.9, 0.9, 2.1], [5.2, -0.7, -0.3, 1.7]];

function Clouds() {
  const quality = useStore((s) => s.quality);
  const spots = quality === 'low' ? CLOUD_SPOTS.slice(0, 5) : CLOUD_SPOTS;
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const shadeRef = useRef<THREE.InstancedMesh>(null!), topRef = useRef<THREE.InstancedMesh>(null!);
  const shadeMat = useMemo(() => toonMat('#fff', { cache: false }), []);
  const topMat = useMemo(() => toonMat('#fff', { cache: false }), []);
  const x = useMemo(() => spots.map((sp) => sp[0]), [spots]); // current x per cloud, advanced each frame
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const i = sunLive.info;
    const fadeStrength = THREE.MathUtils.smoothstep(rig.zoom, 6, 12);
    const half = (rig.viewW / rig.zoom) * 0.55;
    shadeMat.color.copy(i.cloudShade); topMat.color.copy(i.cloudColor);
    let n = 0;
    spots.forEach((s, k) => {
      x[k] += dt * (0.5 + (k % 3) * 0.25); if (x[k] > 95) x[k] = -95;
      const dist = Math.hypot(x[k] - rig.tx, s[2] - rig.tz);
      // opaque clouds shrink away near the camera focus instead of alpha-fading (no transparent overdraw)
      const op = 1 - fadeStrength * (1 - THREE.MathUtils.smoothstep(dist, half * 0.6, half * 1.3));
      const vis = op > 0.02 ? Math.min(1, op * 1.4) : 0;
      PUFFS.forEach((p) => {
        const sc = s[3] * vis;
        o.rotation.set(0, 0, 0);
        o.position.set(x[k] + p[0] * s[3], s[1] + (p[1] - 0.2) * s[3], s[2] + p[2] * s[3]);
        o.scale.set(p[3] * sc, p[3] * 0.62 * sc, p[3] * sc); o.updateMatrix(); shadeRef.current.setMatrixAt(n, o.matrix);
        o.position.set(x[k] + (p[0] + 0.1) * s[3], s[1] + (p[1] + 0.22) * s[3], s[2] + (p[2] + 0.1) * s[3]);
        o.scale.set(p[3] * 0.96 * sc, p[3] * 0.6 * sc, p[3] * 0.96 * sc); o.updateMatrix(); topRef.current.setMatrixAt(n, o.matrix);
        n++;
      });
    });
    shadeRef.current.instanceMatrix.needsUpdate = topRef.current.instanceMatrix.needsUpdate = true;
  });
  const count = spots.length * PUFFS.length;
  return (
    <group>
      <instancedMesh key={'s' + count} ref={shadeRef} args={[geo, shadeMat, count]} frustumCulled={false} />
      <instancedMesh key={'t' + count} ref={topRef} args={[geo, topMat, count]} frustumCulled={false} />
    </group>
  );
}

export function Atmosphere() {
  return (<><SkyQuad /><Lights /><Clouds /></>);
}
