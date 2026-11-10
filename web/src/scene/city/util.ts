export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** The scene is always daytime: lanterns and window glows stay off. */
export const nightNow = () => 0;
export function dateRange(a: string, b: string) {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m1, d1] = a.split('-').map(Number), [, m2, d2] = b.split('-').map(Number);
  if (a === b) return `${d1} ${M[m1 - 1]}`;
  if (m1 === m2) return `${d1}–${d2} ${M[m1 - 1]}`;
  return `${d1} ${M[m1 - 1]} – ${d2} ${M[m2 - 1]}`;
}
export const AUTUMN = ['#d6361f', '#e8601c', '#f08a24', '#c9441f', '#f2b134', '#a82a1c'];
export const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length) % a.length];
