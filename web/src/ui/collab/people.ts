const PALETTE = ['#e4572e', '#2e86de', '#2bb673', '#9b59b6', '#f2b134', '#e84393', '#17a2b8'];
export function personColor(name: string, travellers: string[] = []): string {
  const i = travellers.indexOf(name);
  if (i >= 0) return PALETTE[i % PALETTE.length];
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
