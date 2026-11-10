import * as THREE from 'three';

export const OUTLINE = { color: '#1b2a4a', thickness: 0.03 };

let _grad: THREE.DataTexture | null = null;
/** 3-step toon gradient map (shared). */
export function gradientMap(): THREE.DataTexture {
  if (!_grad) {
    _grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
    _grad.generateMipmaps = false;
    _grad.needsUpdate = true;
  }
  return _grad;
}

const cache = new Map<string, THREE.MeshToonMaterial>();
export interface ToonOpts { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side; vertexColors?: boolean; flatShading?: boolean; cache?: boolean }
/** Shared MeshToonMaterial with the 3-step gradient. Cached by colour when no opts given. */
export function toonMat(color: string, opts: ToonOpts = {}): THREE.MeshToonMaterial {
  const { cache: useCache = true, ...rest } = opts;
  const key = color + JSON.stringify(rest);
  if (useCache) { const c = cache.get(key); if (c) return c; }
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...rest });
  if (useCache) cache.set(key, m);
  return m;
}

export { Outlines as Outlined } from '@react-three/drei';

const outlineCache = new Map<string, THREE.MeshBasicMaterial>();
/** Inverted-hull outline material for InstancedMesh / merged geometry (shifts verts along normals).
 *  Thickness is in object space (instance scale applies). Use with a second mesh sharing the geometry + matrices. */
export function outlineMat(thickness: number = OUTLINE.thickness, color: string = OUTLINE.color): THREE.MeshBasicMaterial {
  const key = `${thickness}|${color}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${thickness.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => `outline${thickness}`;
  outlineCache.set(key, m);
  return m;
}
