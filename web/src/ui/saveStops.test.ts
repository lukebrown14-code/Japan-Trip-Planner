import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stop } from '@shared/types';
import { SEED } from '../data/seed';

const mocks = vi.hoisted(() => {
  const stops: Stop[] = [];
  return {
    stops,
    save: vi.fn<(collection: string, stop: Stop) => Promise<Stop>>(),
    upsert: vi.fn((_collection: string, stop: Stop) => {
      const index = stops.findIndex(s => s.id === stop.id);
      stops[index] = stop;
    }),
  };
});

vi.mock('../store', () => ({ useStore: { getState: () => ({ data: { stops: mocks.stops }, upsert: mocks.upsert }) } }));
vi.mock('./panel/util', () => ({ saveEntity: mocks.save }));

import { saveStopsInOrder, type SaveStopsStatus } from './saveStops';

beforeEach(() => {
  mocks.stops.splice(0, mocks.stops.length, ...SEED.stops.map(s => ({ ...s })));
  mocks.save.mockReset();
  mocks.upsert.mockClear();
});

describe('saveStopsInOrder', () => {
  it('reports a partial failure after the whole pair, restoring only the failed stop', async () => {
    const before = [mocks.stops[0], mocks.stops[1]];
    const changed = before.map((stop, i) => ({ ...stop, [i ? 'arrive' : 'depart']: '2026-10-26' }));
    mocks.stops.splice(0, 2, ...changed);
    mocks.save.mockImplementation(async (_collection, stop) => {
      if (stop.id === before[0].id) throw new Error('network');
      return stop;
    });
    const report = vi.fn(); const statuses: SaveStopsStatus[] = [];
    await saveStopsInOrder(before, report, status => statuses.push(status));

    expect(mocks.stops[0]).toEqual(before[0]);
    expect(mocks.stops[1]).toEqual(changed[1]);
    expect(report).toHaveBeenCalledWith(expect.stringContaining(before[0].name));
    expect(report.mock.lastCall?.[0]).not.toBeNull();
    expect(statuses.map(s => s.phase)).toEqual(['saving', 'error']);
    expect(statuses[1]).toMatchObject({ savedStops: [before[1].name], failedStops: [before[0].name] });
  });

  it('reports a complete save once both adjacent stops succeed', async () => {
    const before = [mocks.stops[2], mocks.stops[3]];
    mocks.stops.splice(2, 2, { ...before[0], depart: '2026-11-01' }, { ...before[1], arrive: '2026-11-01' });
    mocks.save.mockImplementation(async (_collection, stop) => stop);
    const report = vi.fn(); const statuses: SaveStopsStatus[] = [];
    await saveStopsInOrder(before, report, status => statuses.push(status));

    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(report.mock.calls).toEqual([[null]]);
    expect(statuses.map(s => s.phase)).toEqual(['saving', 'saved']);
    expect(statuses[1].savedStops).toEqual(before.map(s => s.name));
  });
});
