import { beforeEach, describe, expect, it, vi } from 'vitest';
import { plannerIsOpen, useStore } from './store';

beforeEach(() => {
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: () => null });
  useStore.setState({ plannerOpen: true, plannerExpanded: false, plannerPanelActive: false, plannerPanelOverride: null });
});
const state = () => useStore.getState();
describe('mobile planner visibility', () => {
  it('temporarily collapses for a panel without changing the saved preference', () => {
    state().setPlannerPanelActive(true);
    expect(plannerIsOpen(state())).toBe(false);
    expect(state().plannerOpen).toBe(true);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    state().setPlannerPanelActive(false);
    expect(plannerIsOpen(state())).toBe(true);
  });
  it('restores an already collapsed preference when a panel closes', () => {
    useStore.setState({ plannerOpen: false });
    state().setPlannerPanelActive(true); state().setPlannerPanelActive(false);
    expect(plannerIsOpen(state())).toBe(false);
  });
  it('allows an explicit reopen while the panel remains visible', () => {
    state().setPlannerPanelActive(true); state().togglePlanner();
    expect(plannerIsOpen(state())).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith('japan-planner-open', '1');
    state().setPlannerPanelActive(false);
    expect(plannerIsOpen(state())).toBe(true);
  });
  it('respects an explicit collapse instead of restoring an older preference', () => {
    state().setPlannerPanelActive(true); state().togglePlanner(); state().togglePlanner();
    state().setPlannerPanelActive(false);
    expect(plannerIsOpen(state())).toBe(false);
    expect(localStorage.setItem).toHaveBeenLastCalledWith('japan-planner-open', '0');
  });
  it('can open Calendar from the compact bar and return to it without persisting a change', () => {
    state().setPlannerPanelActive(true); state().toggleExpanded();
    expect(state().plannerExpanded).toBe(true);
    expect(plannerIsOpen(state())).toBe(true);
    state().toggleExpanded();
    expect(plannerIsOpen(state())).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it('opens Calendar from a saved collapsed preference', () => {
    useStore.setState({ plannerOpen: false }); state().toggleExpanded(); state().toggleExpanded();
    expect(plannerIsOpen(state())).toBe(false);
  });
  it('resets the temporary override when a new panel session begins', () => {
    state().setPlannerPanelActive(true); state().togglePlanner();
    state().setPlannerPanelActive(false); state().setPlannerPanelActive(true);
    expect(plannerIsOpen(state())).toBe(false);
  });
});
