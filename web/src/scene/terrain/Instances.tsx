import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { toonMat, outlineMat } from '../toon';

export interface Inst { p: [number, number, number]; s: [number, number, number]; ry?: number; color?: THREE.Color }
/** Instanced toon mesh with optional inverted-hull outline pass. */
export function ToonInstances({ geometry, items, color = '#ffffff', outline = 0.04, flat = false, castShadow = false }: {
  geometry: THREE.BufferGeometry; items: Inst[]; color?: string; outline?: number; flat?: boolean; castShadow?: boolean;
}) {
  const main = useRef<THREE.InstancedMesh>(null);
  const edge = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => toonMat(color, { flatShading: flat }), [color, flat]);
  const om = useMemo(() => outlineMat(outline), [outline]);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    items.forEach((it, i) => {
      d.position.set(...it.p); d.scale.set(...it.s); d.rotation.set(0, it.ry ?? 0, 0); d.updateMatrix();
      main.current!.setMatrixAt(i, d.matrix); edge.current?.setMatrixAt(i, d.matrix);
      if (it.color) main.current!.setColorAt(i, it.color);
    });
    for (const m of [main.current, edge.current]) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    if (main.current!.instanceColor) main.current!.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return (
    <>
      <instancedMesh key={items.length} ref={main} args={[geometry, mat, items.length]} castShadow={castShadow} receiveShadow frustumCulled={false} />
      {outline > 0 && <instancedMesh key={'o' + items.length} ref={edge} args={[geometry, om, items.length]} frustumCulled={false} />}
    </>
  );
}
