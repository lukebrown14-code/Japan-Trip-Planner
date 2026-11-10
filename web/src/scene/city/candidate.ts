import type { Stop } from '@shared/types';
/** Cities in CITIES that are not (yet) a trip stop render as small, muted "candidates". */
export const CANDIDATE_SCALE = 0.55;
export const CANDIDATE_MUTE = 0.55; // 0 = original colour, 1 = fully grey
export const isOnRoute = (cityKey: string, stops: Pick<Stop, 'cityKey'>[]) => stops.some(s => s.cityKey === cityKey);
/** Desaturate and lighten a hex colour toward grey. */
export function mutedHex(hex: string, amt = CANDIDATE_MUTE): string {
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const y = 0.3 * r + 0.59 * g + 0.11 * b, f = (c: number) => Math.round(c + (y * 0.9 + 25 - c) * amt);
  return '#' + [f(r), f(g), f(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}
