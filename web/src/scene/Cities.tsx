import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from '../store';
import { toWorld } from '../geo';
import { CITIES, AIRPORTS } from '../data/cities';
import { City } from './city/City';
import { dateRange } from './city/util';
import { LabelProjector } from "./city/LabelLayer";
import { isOnRoute } from './city/candidate';
import { useCandidate, focusCityFromMap } from '../ui/AddToTripCard';
import { Airport } from './landmarks/Airport';


export function Cities() {
  const data = useStore(s => s.data), sel = useStore(s => s.selectedStopId), set = useStore(s => s.set);
  const showcase = typeof location !== 'undefined' && new URLSearchParams(location.search).get('play') === 'cities';
  const [hx, hz] = toWorld(AIRPORTS.HND.lat, AIRPORTS.HND.lng);
  return (
    <group>
      {data.stops.map(s => {
        const p = CITIES[s.cityKey], [x, z] = toWorld(s.lat, s.lng);
        return <City key={s.id} id={s.id} kind={p?.landmark ?? 'generic'} position={[x, 0, z]} name={s.name} nameJa={s.nameJa}
          dates={dateRange(s.arrive, s.depart)} selected={sel === s.id}
          onSelect={() => focusCityFromMap(s.id)} />;
      })}
      {Object.values(CITIES).filter(c => !isOnRoute(c.key, data.stops)).map(c => {
        const [x, z] = toWorld(c.lat, c.lng);
        return <City key={'cand:' + c.key} id={'cand:' + c.key} candidate kind={c.landmark} position={[x, 0, z]} name={c.name} nameJa={c.nameJa} selected={false}
          onSelect={() => { set({ selectedStopId: null }); useCandidate.getState().set(c.key); }} />;
      })}
      <group position={[hx + 1.5, 0, hz + 3.5]} scale={0.8}><Airport /></group>
      <LabelProjector />
      {showcase && <Showcase />}
    </group>
  );
}

/** ?play=cities helper: city picker overlay + camera focus. Harmless otherwise (not rendered). */
function Showcase() {
  const stops = useStore(s => s.data.stops), sel = useStore(s => s.selectedStopId), set = useStore(s => s.set);
  const { camera } = useThree();
  useFrame(() => {
    const s = stops.find(x => x.id === sel); if (!s) return;
    const [x, z] = toWorld(s.lat, s.lng), o = camera as import('three').OrthographicCamera;
    const tx = x + 40, ty = 45, tz = z + 40;
    camera.position.x += (tx - camera.position.x) * 0.1; camera.position.y += (ty - camera.position.y) * 0.1; camera.position.z += (tz - camera.position.z) * 0.1;
    o.zoom += (55 - o.zoom) * 0.1; o.updateProjectionMatrix(); camera.lookAt(x, 2, z);
  });
  return <Html fullscreen zIndexRange={[50, 40]} style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', pointerEvents: 'none' }}>
      {stops.map(s => <button key={s.id} onClick={() => set({ selectedStopId: s.id })} style={{ pointerEvents: 'auto', padding: '6px 12px', borderRadius: 8, border: '2px solid #1b2a4a', background: sel === s.id ? '#ffd666' : '#fff6e0', font: 'inherit' }}>{s.nameJa} {s.name}</button>)}
    </div>
  </Html>;
}
