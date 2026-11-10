export const transportHref = (key?: string) => key ? `/transport/journeys/${encodeURIComponent(key)}` : '/transport';
export function transportRouteKey(path: string): string | undefined {
  const prefix = '/transport/journeys/';
  if (!path.startsWith(prefix)) return undefined;
  try { return decodeURIComponent(path.slice(prefix.length)); } catch { return undefined; }
}
export const isTransportPath = (path: string) => path === '/transport' || path.startsWith('/transport/journeys/');
