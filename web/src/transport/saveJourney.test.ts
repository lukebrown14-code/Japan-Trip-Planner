import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED } from '../data/seed';
const save=vi.hoisted(()=>vi.fn());
vi.mock('../api',()=>({api:{save}}));
import { useStore } from '../store';
import { confirmJourneyReview, saveJourneyDetails } from './saveJourney';
import { journeyView } from './viewModel';
beforeEach(()=>{
  useStore.getState().set({data:structuredClone(SEED)});save.mockReset();
  save.mockImplementation(async(_collection,entity)=>structuredClone(entity));
});
describe('shared journey persistence',()=>{
  it('clears optional details explicitly and never restores legacy values',async()=>{
    const state=useStore.getState();state.set({data:{...state.data,legs:state.data.legs.map((l,i)=>i===0?{...l,confirmation:'OLD',notes:'OLD',cost:100}:l)}});
    await saveJourneyDetails('leg:s0:s1',{confirmation:undefined,notes:undefined,cost:undefined,segments:[]});
    expect(save.mock.calls[0][1]).toMatchObject({confirmation:null,notes:null,cost:null,segments:[]});
    const view=journeyView(useStore.getState().data,'leg:s0:s1')!;
    expect(view.services).toEqual([]);expect(view.confirmation).toBeUndefined();expect(view.notes).toBeUndefined();expect(view.totalPaid).toBeUndefined();
  });
  it('preserves changed-booking review snapshots on ordinary editing',async()=>{
    const state=useStore.getState();state.set({data:{...state.data,stops:state.data.stops.map((s,i)=>i===1?{...s,arrive:'2026-10-28'}:s)}});
    await saveJourneyDetails('leg:s0:s1',{notes:'Keep tickets'});
    const view=journeyView(useStore.getState().data,'leg:s0:s1')!;
    expect(view.status).toBe('needs_review');expect(view.booking?.travelDate).toBe('2026-10-27');
    await confirmJourneyReview(view.key);
    expect(journeyView(useStore.getState().data,view.key)?.status).toBe('arranged');
  });
  it('does not mutate stored state after save failure or resurrect a removed journey',async()=>{
    save.mockRejectedValueOnce(new Error('Offline'));const before=JSON.stringify(useStore.getState().data);
    await expect(saveJourneyDetails('leg:s0:s1',{confirmation:'DRAFT'})).rejects.toThrow('Offline');
    expect(JSON.stringify(useStore.getState().data)).toBe(before);
    const state=useStore.getState();state.set({data:{...state.data,stops:state.data.stops.filter(s=>s.id!=='s1')}});
    await expect(saveJourneyDetails('leg:s0:s1',{confirmation:'DRAFT'})).rejects.toThrow('removed');expect(save).toHaveBeenCalledTimes(1);
  });
});
