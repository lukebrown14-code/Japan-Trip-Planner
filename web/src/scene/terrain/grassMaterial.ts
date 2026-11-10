import { useMemo } from 'react';
import * as THREE from 'three';
import { gradientMap } from '../toon';
import { MASK } from './ranges';
import maskUrl from '../../assets/landmask.png';

let _mask: THREE.Texture | null = null;
/** baked ground mask (R signed coast distance, G ridge proximity). Loads async; shader sees zeros until then. */
export function landMask(): THREE.Texture {
  if (!_mask) {
    _mask = new THREE.TextureLoader().load(maskUrl);
    _mask.flipY = false;
    _mask.colorSpace = THREE.NoColorSpace;
    _mask.minFilter = _mask.magFilter = THREE.LinearFilter;
    _mask.generateMipmaps = false;
    _mask.wrapS = _mask.wrapT = THREE.ClampToEdgeWrapping;
  }
  return _mask;
}

const NOISE = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }`;

/** regional autumn ground: latitude tint, coastal sand/shingle (on land), forest->brown near ridges, inland field patchwork */
function groundFrag(low: boolean) {
  return `
{
  vec2 xz = vW.xz;
  vec4 mk = texture2D(uMask, (xz - uMaskO) / uMaskS);
  float dl = max(0., (mk.r*255. - 128.) / 127. * uSdf);   // metres-ish: world units inland from coast
  float rid = mk.g;
  float lat = 37. - xz.y / 16.;
  float cold = smoothstep(37.0, 43.0, lat);               // Hokkaido / Tohoku
  float warm = 1. - smoothstep(32.0, 35.5, lat);          // Kyushu / Chugoku

  // broad regional noise (large) + painted patches (medium) + speckle (small)
  float nL = vn(xz*0.07), nM = vn(xz*0.23 + 11.), nS = vn(xz*0.9 + 3.);
  float n = nL*0.45 + nM*0.4 + nS*0.15;
  n = n + cold*0.16 - warm*0.2;                           // colder = earlier autumn, south = greener
  n = floor(n*6.0 + 0.5)/6.0;                             // posterise: patches read as painted bands

  vec3 olive = vec3(0.58,0.70,0.32), green = vec3(0.44,0.62,0.28), gold = vec3(0.90,0.74,0.28), orange = vec3(0.92,0.50,0.20), red = vec3(0.80,0.33,0.17);
  vec3 c = mix(olive, gold, smoothstep(0.30,0.5,n));
  c = mix(c, green, warm*(1.-smoothstep(0.30,0.55,n))*0.8);
  c = mix(c, orange, smoothstep(0.55,0.75,n));
  c = mix(c, red, cold*smoothstep(0.66,0.8,n));

  // inland plains: patchwork fields + path lines
  ${low ? '' : `
  float plain = (1. - smoothstep(0.1,0.45,rid)) * smoothstep(0.6,1.6,dl) * smoothstep(0.38,0.5,vn(xz*0.05+40.));
  if (plain > 0.01) {
    float ang = 0.35 + nL*0.5; mat2 R = mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
    vec2 g = R * xz / 0.42; vec2 id = floor(g), f = fract(g);
    float hv = h21(id);
    vec3 fieldC = hv < 0.35 ? vec3(0.55,0.70,0.24) : (hv < 0.7 ? vec3(0.80,0.68,0.26) : vec3(0.42,0.60,0.22));
    fieldC *= 0.92 + 0.14*h21(id+7.);
    vec2 fw = fwidth(g)*1.2;
    vec2 e = smoothstep(vec2(0.), fw + 0.07, min(f, 1.-f));
    float pathLine = (1. - min(e.x, e.y)) * (1. - smoothstep(0.25, 0.6, max(fw.x, fw.y)));                 // thin lighter dirt lines between fields
    fieldC = mix(fieldC, vec3(0.74,0.66,0.40), pathLine*0.7);
    c = mix(c, fieldC, plain*0.75);
    // occasional road line across plains
    float rd = abs(fract(dot(xz, vec2(0.55,-0.83))*0.09 + 0.3) - 0.5);
    c = mix(c, vec3(0.82,0.74,0.54), plain * (1.-smoothstep(0.004, 0.009, rd)) * step(0.55, h21(vec2(floor(dot(xz, vec2(0.55,-0.83))*0.09+0.2), 3.))));
  }`}

  // forest green -> brown near ridges
  float rn = rid + (nM-0.5)*0.35;
  vec3 forest = mix(vec3(0.26,0.50,0.20), vec3(0.36,0.50,0.18), cold*0.6);
  forest = mix(forest, vec3(0.50,0.36,0.20), cold*0.3);
  c = mix(c, forest, smoothstep(0.22,0.36,rn));
  c = mix(c, vec3(0.56,0.42,0.28), smoothstep(0.78,0.92,rn) * 0.7);

  // beach on land: wet sand, dry sand, shingle fleck, grass fringe
  float dj = dl + (nS-0.5)*0.10 + (nM-0.5)*0.08;
  vec3 sand = mix(vec3(0.93,0.84,0.60), vec3(0.88,0.78,0.56), step(0.6, nS));
  sand = mix(sand, vec3(0.76,0.70,0.58), step(0.8, h21(floor(xz*14.))) * 0.7);
  sand = mix(vec3(0.78,0.68,0.46), sand, step(0.07, dj));    // wet band at the waterline
  float beachW = 0.20 - cold*0.04;
  c = mix(c, sand, 1. - smoothstep(beachW, beachW + 0.05, dj));
  c = mix(c, c*0.9 + vec3(0.04,0.05,0.0), (1.-smoothstep(beachW+0.05, beachW+0.2, dj)) * step(beachW+0.05, dj)); // darker grass fringe behind the beach
  diffuseColor.rgb = pow(c, vec3(1.4));   // palette is authored in sRGB-ish values; deepen for the linear pipeline
}`;
}

/** regional autumn ground material (toon). `low` drops the field-patchwork branch. */
export function useGrassMat(quality: 'low' | 'high' | string = 'high') {
  const low = quality === 'low';
  return useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color: '#b9c25a', gradientMap: gradientMap() });
    const uniforms = {
      uMask: { value: landMask() },
      uMaskO: { value: new THREE.Vector2(MASK.x0, MASK.z0) },
      uMaskS: { value: new THREE.Vector2(MASK.x1 - MASK.x0, MASK.z1 - MASK.z0) },
      uSdf: { value: MASK.sdfRange },
    };
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vW; uniform sampler2D uMask; uniform vec2 uMaskO, uMaskS; uniform float uSdf;${NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>${groundFrag(low)}`);
    };
    m.customProgramCacheKey = () => (low ? 'regionalGroundLow' : 'regionalGround');
    return m;
  }, [low]);
}
