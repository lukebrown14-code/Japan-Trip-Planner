import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../../store';
import { toonMat } from '../toon';
import { EDGES, NODES } from '../../data/rails';
import { toWorld } from '../../geo';
import { CITIES } from '../../data/cities';
import { GROUND, ELEV, DECK_Y, edgeCurve, edgeId, legRoute, tripLegs } from './routes';
import { isOnRoute } from '../city/candidate';
import { ribbonGeometry, posesAlong } from './geom';
import { onLand } from '../terrain/geometry';
import { Outlines } from '@react-three/drei';

const dummy = new THREE.Object3D();
function Instanced({ geo, mat, poses, y = 0, sy = 1 }: { geo: THREE.BufferGeometry; mat: THREE.Material; poses: { p: THREE.Vector3; yaw: number; s?: [number, number, number] }[]; y?: number; sy?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const setRef = (m: THREE.InstancedMesh | null) => {
    if (!m) return; ref.current = m;
    poses.forEach((q, i) => { dummy.position.set(q.p.x, q.p.y + y, q.p.z); dummy.rotation.set(0, q.yaw, 0); dummy.scale.set(...(q.s ?? [1, sy, 1])); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.instanceMatrix.needsUpdate = true;
  };
  if (!poses.length) return null;
  return <instancedMesh ref={setRef} args={[geo, mat, poses.length]} frustumCulled={false} />;
}

const FAINT = { rail: '#9a8f86', sleeper: '#b9a58f', shin: '#a9b8d0', bus: '#c9bba5' };

/** Whole network, drawn low and faint. */
function Network() {
  const data = useStore(s => s.data); const { stops: dStops, legs: dLegs, flights: dFlights } = data;
  const { ribbons, sleepers, dashes, cdashes } = useMemo(() => {
    const used = new Set<string>(); for (const l of tripLegs(data)) for (const st of legRoute(l.from, l.to).steps) used.add(edgeId(st.edge));
    const stn = (k: string) => CITIES[k]?.station ?? k, onSt = new Set(data.stops.map(x => stn(x.cityKey)));
    const cand = new Set(Object.values(CITIES).filter(c => !isOnRoute(c.key, data.stops)).map(c => c.station).filter(n => !onSt.has(n))); // candidate-only nodes
    const cdashes: { p: THREE.Vector3; yaw: number }[] = [];
    const ribbons: { g: THREE.BufferGeometry; shin: boolean }[] = []; const sleepers: { p: THREE.Vector3; yaw: number; s: [number, number, number] }[] = []; const dashes: { p: THREE.Vector3; yaw: number }[] = [];
    for (const e of EDGES) {
      const c = edgeCurve({ edge: e }, GROUND + 0.02); const shin = e.mode === 'shinkansen';
      if (!used.has(edgeId(e)) && (cand.has(e.a) || cand.has(e.b))) { cdashes.push(...posesAlong(c, 0.16)); continue; } // candidate edge: thin dashed grey
      if (e.mode === 'bus' || e.mode === 'walk') { dashes.push(...posesAlong(c, 0.18)); continue; }
      ribbons.push({ g: ribbonGeometry(c.getSpacedPoints(Math.max(8, Math.ceil(c.getLength() / 0.1))), shin ? 0.07 : 0.04, 0.015), shin });
      const w = shin ? 0.16 : 0.1; sleepers.push(...posesAlong(c, shin ? 0.09 : 0.11).map(q => ({ ...q, yaw: q.yaw + Math.PI / 2, s: [w, 1, 1] as [number, number, number] })));
    }
    return { ribbons, sleepers, dashes, cdashes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dStops, dLegs, dFlights]);
  const box = useMemo(() => new THREE.BoxGeometry(1, 0.012, 0.025), []);
  const dashG = useMemo(() => new THREE.BoxGeometry(0.1, 0.01, 0.025), []);
  const cdashG = useMemo(() => new THREE.BoxGeometry(0.07, 0.008, 0.012), []);
  return (
    <group>
      {ribbons.map((r, i) => <mesh key={i} geometry={r.g} material={toonMat(r.shin ? FAINT.shin : FAINT.rail)} />)}
      <Instanced geo={box} mat={toonMat(FAINT.sleeper)} poses={sleepers} y={0.0} />
      <Instanced geo={dashG} mat={toonMat(FAINT.bus)} poses={dashes} />
      <Instanced geo={cdashG} mat={toonMat('#a3a3a3')} poses={cdashes} />
    </group>
  );
}

/** Raised, glowing trip route (viaduct). */
function Route() {
  const data = useStore(s => s.data);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffc566', toneMapped: false }), []);
  const { decks, glows, pillars, stations } = useMemo(() => {
    const seen = new Map<string, { edge: (typeof EDGES)[number] }>(); const nodes = new Set<string>();
    for (const l of tripLegs(data)) for (const s of legRoute(l.from, l.to).steps) { seen.set(edgeId(s.edge), { edge: s.edge }); nodes.add(s.edge.a); nodes.add(s.edge.b); }
    const decks: { g: THREE.BufferGeometry; shin: boolean }[] = []; const glows: THREE.BufferGeometry[] = []; const pillars: { p: THREE.Vector3; yaw: number; s: [number, number, number] }[] = [];
    for (const { edge } of seen.values()) {
      const c = edgeCurve({ edge }); const shin = edge.mode === 'shinkansen'; const w = shin ? 0.2 : 0.14;
      const pts = c.getSpacedPoints(Math.max(8, Math.ceil(c.getLength() / 0.06)));
      decks.push({ g: ribbonGeometry(pts, w, 0.07), shin });
      for (const off of [-w * 0.32, w * 0.32]) {
        const sp = pts.map((p, i) => { const t = new THREE.Vector3().subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).setY(0).normalize(); return new THREE.Vector3(p.x - t.z * off, p.y + 0.012, p.z + t.x * off); });
        glows.push(ribbonGeometry(sp, 0.018, 0.012));
      }
      pillars.push(...posesAlong(c, 0.55, 0.1).filter(q => onLand(q.p.x, q.p.z)).map(q => ({ ...q, s: [1, 1, 1] as [number, number, number] })));
    }
    const stations = [...nodes].map(id => NODES.find(n => n.id === id)!).map(n => { const [x, z] = toWorld(n.lat, n.lng); return { id: n.id, x, z, label: Object.values(CITIES).find(c => c.station === n.id || c.key === n.id)?.name ?? (n.id === 'hnd' ? 'Haneda' : n.id === 'nrt' ? 'Narita' : n.id) }; });
    return { decks, glows, pillars, stations };
  }, [data]);
  const pillarG = useMemo(() => { const g = new THREE.CylinderGeometry(0.028, 0.04, ELEV, 8); g.translate(0, -ELEV / 2 - 0.07, 0); return g; }, []);
  const pulse = useRef<THREE.MeshBasicMaterial>(glowMat);
  useFrame(({ clock }) => { pulse.current.color.setHSL(0.11, 1, 0.62 + Math.sin(clock.elapsedTime * 2.2) * 0.06); });
  return (
    <group>
      {decks.map((d, i) => <mesh key={i} geometry={d.g} material={toonMat(d.shin ? '#59658f' : '#6d6480')} castShadow />)}
      {glows.map((g, i) => <mesh key={i} geometry={g} material={glowMat} />)}
      <Instanced geo={pillarG} mat={toonMat('#8d85a3')} poses={pillars} />
      {stations.map(s => (
        <group key={s.id} position={[s.x, DECK_Y, s.z]}>
          <mesh position={[0, 0.03, 0]} material={toonMat('#f4ead2')}><boxGeometry args={[0.5, 0.05, 0.22]} /><Outlines thickness={0.015} color="#1b2a4a" /></mesh>
          <mesh position={[0, 0.17, 0]} material={toonMat('#e5543c')}><boxGeometry args={[0.28, 0.04, 0.2]} /><Outlines thickness={0.015} color="#1b2a4a" /></mesh>
          {[-0.12, 0.12].map(x => <mesh key={x} position={[x, 0.1, 0.08]} material={toonMat('#f4ead2')}><boxGeometry args={[0.02, 0.14, 0.02]} /></mesh>)}
          <mesh position={[0, -ELEV / 2 - 0.07, 0]} material={toonMat('#8d85a3')}><cylinderGeometry args={[0.06, 0.08, ELEV, 10]} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function Rails() { return <><Network /><Route /></>; }
