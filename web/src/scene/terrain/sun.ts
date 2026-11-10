import * as THREE from 'three';
import * as SunCalc from 'suncalc';

export const JAPAN_CENTRE = { lat: 36.0, lng: 138.0 };
export type Phase = 'night' | 'dawn' | 'day' | 'dusk';
export interface SunInfo {
  date: Date; altDeg: number; azimuth: number; morning: boolean;
  phase: Phase; night: number; day: number;
  /** unit vector pointing from the ground toward the sun (world: x east, z south) */
  sunDir: THREE.Vector3; moonDir: THREE.Vector3;
  skyTop: THREE.Color; skyHorizon: THREE.Color;
  lightColor: THREE.Color; lightIntensity: number;
  ambColor: THREE.Color; ambIntensity: number;
  hemiGround: THREE.Color;
  cloudColor: THREE.Color; cloudShade: THREE.Color;
  seaDeep: THREE.Color; seaLight: THREE.Color;
}

const C = (h: string) => new THREE.Color(h);
const DAWN = C('#ff9ab8'), DUSK = C('#ff8c3a');
interface Stop { alt: number; top: THREE.Color; hor: THREE.Color | 'warm'; light: THREE.Color; li: number; amb: THREE.Color; ai: number; cloud: THREE.Color; shade: THREE.Color; sea: THREE.Color; seaL: THREE.Color }
const STOPS: Stop[] = [
  { alt: -18, top: C('#070b24'), hor: C('#141c45'), light: C('#8fa8ff'), li: 0.55, amb: C('#3b4a8f'), ai: 0.75, cloud: C('#46528f'), shade: C('#262d5c'), sea: C('#0d1f4a'), seaL: C('#2a4a8a') },
  { alt: -8, top: C('#16215a'), hor: C('#4a3f86'), light: C('#9fb0ff'), li: 0.5, amb: C('#4a5499'), ai: 0.75, cloud: C('#7a6aa8'), shade: C('#3a3a78'), sea: C('#16316a'), seaL: C('#3c5fa5') },
  { alt: -2, top: C('#34458f'), hor: 'warm', light: C('#ffb08a'), li: 0.9, amb: C('#8a78b8'), ai: 0.8, cloud: C('#ffb59a'), shade: C('#8a6a9e'), sea: C('#1f4684'), seaL: C('#6a7fb0') },
  { alt: 3, top: C('#5a78c0'), hor: 'warm', light: C('#ffb27a'), li: 1.6, amb: C('#b09ac8'), ai: 0.85, cloud: C('#ffc8a8'), shade: C('#a88ab8'), sea: C('#2a5c9c'), seaL: C('#8ab0d0') },
  { alt: 10, top: C('#5fa0e0'), hor: C('#ffd9b0'), light: C('#ffd9a0'), li: 2.1, amb: C('#c4d6f2'), ai: 0.9, cloud: C('#fff1e0'), shade: C('#b8c8e8'), sea: C('#2f78bc'), seaL: C('#7cd0e0') },
  { alt: 28, top: C('#3d93e6'), hor: C('#bfe6f7'), light: C('#fff1d0'), li: 2.4, amb: C('#bcd8ff'), ai: 0.95, cloud: C('#ffffff'), shade: C('#aecbee'), sea: C('#2a86d0'), seaL: C('#6fe0e6') },
  { alt: 70, top: C('#2f88e6'), hor: C('#c8ecfa'), light: C('#fff6dc'), li: 2.5, amb: C('#c4dcff'), ai: 1.0, cloud: C('#ffffff'), shade: C('#b4d0f0'), sea: C('#2a86d0'), seaL: C('#6fe0e6') },
];

const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Pure: sun state for a real date at Japan's centre. */
export function computeSun(date: Date): SunInfo {
  const p = SunCalc.getPosition(date, JAPAN_CENTRE.lat, JAPAN_CENTRE.lng);
  const altDeg = (p.altitude * 180) / Math.PI;
  const az = p.azimuth; // from south, west positive
  const morning = Math.sin(az) < 0;
  const warm = morning ? DAWN : DUSK;
  // locate stops
  let i = 0;
  while (i < STOPS.length - 2 && altDeg > STOPS[i + 1].alt) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  const t = Math.min(1, Math.max(0, (altDeg - a.alt) / (b.alt - a.alt)));
  const hor = (s: Stop) => (s.hor === 'warm' ? warm : s.hor);
  const mix = (x: THREE.Color, y: THREE.Color) => x.clone().lerp(y, t);
  const hc = mix(hor(a), hor(b));
  if (a.hor === 'warm' || b.hor === 'warm') hc.lerp(warm, 0.0);
  const cos = Math.cos(p.altitude);
  const sunDir = new THREE.Vector3(-Math.sin(az) * cos, Math.sin(p.altitude), Math.cos(az) * cos).normalize();
  const moonDir = new THREE.Vector3(-sunDir.x, Math.max(0.35, -sunDir.y), -sunDir.z).normalize();
  const night = 1 - sm(-10, 2, altDeg);
  const day = sm(2, 14, altDeg);
  const phase: Phase = altDeg < -4 ? 'night' : altDeg < 8 ? (morning ? 'dawn' : 'dusk') : 'day';
  return {
    date, altDeg, azimuth: az, morning, phase, night, day, sunDir, moonDir,
    skyTop: mix(a.top, b.top), skyHorizon: hc,
    lightColor: mix(a.light, b.light), lightIntensity: a.li + (b.li - a.li) * t,
    ambColor: mix(a.amb, b.amb), ambIntensity: a.ai + (b.ai - a.ai) * t,
    hemiGround: mix(a.amb, b.amb).multiplyScalar(0.55).lerp(C('#8a5a30'), 0.35),
    cloudColor: mix(a.cloud, b.cloud), cloudShade: mix(a.shade, b.shade),
    seaDeep: mix(a.sea, b.sea), seaLight: mix(a.seaL, b.seaL),
  };
}

/** Fixed midday sun: the scene is always daytime. */
export const sunLive: { info: SunInfo } = { info: computeSun(new Date(Date.parse('2026-10-24T12:00:00+09:00'))) };
