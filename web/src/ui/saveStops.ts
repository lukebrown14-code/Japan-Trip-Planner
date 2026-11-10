// Serial, rollback-safe saving for optimistic stop edits (the planner previews dates in the store, then persists them here).
// Saves run one at a time, in order. Each task re-reads the live stop, so rapid edits (a held arrow key) collapse into the latest dates.
// `confirmed` holds the last server-acknowledged copy of every stop touched; a failed save rolls back only that stop to it.
import type { Stop } from '@shared/types';
import { useStore } from '../store';
import { saveEntity } from './panel/util';

const confirmed = new Map<string, Stop>();
let queue: Promise<void> = Promise.resolve();
let pending = 0;

export interface SaveStopsStatus {
  phase: 'saving' | 'saved' | 'error';
  savedStops: string[];
  failedStops: string[];
}

/** `before` = the stops before the optimistic edit. `report` remains compatible with the existing error setter. */
export function saveStopsInOrder(before: Stop[], report: (error: string | null) => void, onStatus?: (status: SaveStopsStatus) => void): Promise<void> {
  if (pending === 0) confirmed.clear(); // idle: forget old baselines (other travellers may have changed stops since)
  for (const s of before) if (!confirmed.has(s.id)) confirmed.set(s.id, s);
  pending++;
  queue = queue.then(async () => {
    const savedStops: string[] = [], failedStops: string[] = [];
    try {
      report(null);
      onStatus?.({ phase: 'saving', savedStops: [], failedStops: [] });
      for (const { id } of before) {
        const live = useStore.getState().data.stops.find(s => s.id === id), base = confirmed.get(id);
        if (!live || !base || (live.arrive === base.arrive && live.depart === base.depart)) continue;
        try { confirmed.set(id, await saveEntity('stops', live)); savedStops.push(live.name); }
        catch (err) {
          console.error('date change failed', err);
          // A newer queued edit may have superseded this preview while the request was in flight.
          const current = useStore.getState().data.stops.find(s => s.id === id);
          if (current?.arrive === live.arrive && current.depart === live.depart) useStore.getState().upsert('stops', base);
          failedStops.push(live.name);
        }
      }
      if (failedStops.length) {
        report(`Couldn’t save dates for ${failedStops.join(', ')}. Review the timeline and try again.`);
        onStatus?.({ phase: 'error', savedStops: [...savedStops], failedStops: [...failedStops] });
      } else onStatus?.({ phase: 'saved', savedStops: [...savedStops], failedStops: [] });
    } finally { pending--; }
  });
  return queue;
}
