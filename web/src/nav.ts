import { useSyncExternalStore, type MouseEvent } from 'react';

const subscribe = (cb: () => void) => { addEventListener('popstate', cb); return () => removeEventListener('popstate', cb); };
export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname);
type Guard = (proceed: () => void) => void;
let guard: Guard | undefined;
let currentPath = typeof location === 'undefined' ? '/' : location.pathname;
let currentIndex = typeof history === 'undefined' ? 0 : Number(history.state?.tripNavIndex ?? 0);
let restoring = false;
let pendingPop: { target: string; index: number; delta: number } | undefined;
if (typeof history !== 'undefined') history.replaceState({ ...history.state, tripNavIndex: currentIndex }, '', location.href);
/** A dirty editor owns this guard; its dialog calls proceed only after save/discard. */
export function registerNavigationGuard(next: Guard) {
  guard = next;
  return () => { if (guard === next) guard = undefined; };
}
export function navigate(to: string) {
  if (location.pathname === to) return;
  const proceed = () => {
    currentPath = to; currentIndex++;
    history.pushState({ tripNavIndex: currentIndex }, '', to);
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  };
  if (guard) guard(proceed); else proceed();
}
if (typeof window !== 'undefined') addEventListener('popstate', event => {
  const target = location.pathname;
  const index = Number(history.state?.tripNavIndex ?? currentIndex - 1);
  if (restoring) {
    restoring = false; event.stopImmediatePropagation();
    const pending = pendingPop; pendingPop = undefined;
    if (pending && guard) guard(() => {
      currentPath = pending.target; currentIndex = pending.index;
      history.go(pending.delta);
    });
    return;
  }
  if (target === currentPath) return;
  if (guard) {
    event.stopImmediatePropagation();
    const delta = index - currentIndex;
    if (delta) {
      pendingPop = { target, index, delta }; restoring = true; history.go(-delta);
    } else {
      history.replaceState({ tripNavIndex: currentIndex }, '', currentPath);
      guard(() => { currentPath=target; currentIndex++; history.pushState({tripNavIndex:currentIndex},'',target); dispatchEvent(new PopStateEvent('popstate')); });
    }
  } else { currentPath = target; currentIndex = index; }
});
export function navClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); navigate(e.currentTarget.pathname);
}
