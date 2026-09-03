import { useEffect } from 'react';

interface BodyStyleSnapshot {
  overflow: string;
  overscrollBehavior: string;
  paddingRight: string;
}

const owners = new Set<string>();
let snapshot: BodyStyleSnapshot | null = null;

const getScrollbarWidth = (): number =>
  Math.max(0, window.innerWidth - document.documentElement.clientWidth);

export const lockBodyScroll = (ownerId: string): void => {
  if (typeof document === 'undefined' || owners.has(ownerId)) return;

  if (owners.size === 0) {
    snapshot = {
      overflow: document.body.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
      paddingRight: document.body.style.paddingRight,
    };
    const scrollbarWidth = getScrollbarWidth();
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  owners.add(ownerId);
};

export const unlockBodyScroll = (ownerId: string): void => {
  if (typeof document === 'undefined' || !owners.delete(ownerId)) return;
  if (owners.size > 0 || !snapshot) return;

  document.body.style.overflow = snapshot.overflow;
  document.body.style.overscrollBehavior = snapshot.overscrollBehavior;
  document.body.style.paddingRight = snapshot.paddingRight;
  snapshot = null;
};

export const useBodyScrollLock = (active: boolean, ownerId: string): void => {
  useEffect(() => {
    if (!active) return undefined;
    lockBodyScroll(ownerId);
    return () => unlockBodyScroll(ownerId);
  }, [active, ownerId]);
};

