import { describe, it, expect } from 'vitest';
import { CITIES } from './data/cities';
import { NODES, shortestPath } from './data/rails';

const ids = (a: string, b: string) => shortestPath(a, b).map(s => s.edge.a + '-' + s.edge.b);

describe('rails', () => {
  it('every city station has a node', () => {
    for (const c of Object.values(CITIES)) expect(NODES.some(n => n.id === c.station), c.key).toBe(true);
  });
  it('every node is reachable from tokyo', () => {
    for (const n of NODES) if (n.id !== 'tokyo') expect(shortestPath('tokyo', n.id).length, n.id).toBeGreaterThan(0);
  });
  it('existing routes keep their shape', () => {
    expect(ids('tokyo', 'nikko')).toEqual(['tokyo-omiya', 'omiya-utsunomiya', 'utsunomiya-nikko']);
    expect(ids('kyoto', 'osaka')).toEqual(['kyoto-osaka']);
    expect(ids('tokyo', 'odawara')).toEqual(['tokyo-odawara']);
    expect(ids('nagoya', 'osaka')).toEqual(['nagoya-kyoto', 'kyoto-osaka']);
    expect(ids('tokyo', 'kyoto')).toEqual(['tokyo-odawara', 'odawara-nagoya', 'nagoya-kyoto']);
    expect(ids('toyama', 'takayama')).toEqual(['toyama-takayama']);
    expect(ids('kyoto', 'nara')).toEqual(['kyoto-nara']);
  });
});
