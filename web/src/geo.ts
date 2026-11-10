// lat/lng -> scene world coords. x east, z south (three.js ground plane y=0). 1 unit ≈ 0.0625° lng.
export const CENTER = { lat: 37.0, lng: 137.5 };
const KX = 16, KZ = 16;
const base = (lat: number, lng: number): [number, number] => [(lng - CENTER.lng) * Math.cos((CENTER.lat * Math.PI) / 180) * KX, -(lat - CENTER.lat) * KZ];
// Kyoto and Osaka are ~40km apart: nudge the Kansai area north-east around Kyoto (smooth falloff, so coast/rails stay consistent)
const [KX0, KZ0] = base(35.003, 135.759);
const PUSH = [2.2, -2.9], SIGMA = 4.5;
export function toWorld(lat: number, lng: number): [number, number] {
  const [x, z] = base(lat, lng);
  const d2 = (x - KX0) ** 2 + (z - KZ0) ** 2, w = Math.exp(-d2 / (SIGMA * SIGMA));
  return [x + PUSH[0] * w, z + PUSH[1] * w];
}
