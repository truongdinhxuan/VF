import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ConfirmDrawerConfig,
  ConfirmDrawerEntry,
  CrudDrawerUpdate,
  CrudDrawerConfig,
  CrudDrawerEntry,
  OffcanvasCloseReason,
  OffcanvasContextValue,
  OffcanvasState,
} from '../../types/offcanvas.types';
import { useBodyScrollLock } from '../../utils/bodyScrollLock';
import {
  focusFirstElement,
  restoreFocus,
  trapTabKey,
} from '../../utils/focusManagement';
import { ConfirmOffcanvas } from './ConfirmOffcanvas';
import { CrudOffcanvas } from './CrudOffcanvas';
import { OffcanvasContext } from './OffcanvasContext';

const EXIT_DURATION_MS = 220;
let drawerSequence = 0;

const nextDrawerId = (kind: 'crud' | 'confirm'): string => {
  drawerSequence += 1;
  return `${kind}-offcanvas-${drawerSequence}`;
};

const activeElement = (): HTMLElement | null =>
  typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

const warnStackLimit = (): void => {
  if (import.meta.env.DEV) {
    console.warn('Offcanvas stack is limited to one primary and one confirmation layer.');
  }
};

interface CloseOptions {
  afterClosed?: () => void;
  restoreTrigger?: boolean;
}

export const OffcanvasProvider = ({
  children,
  onDrawerOpen,
}: {
  children: ReactNode;
  onDrawerOpen?: () => void;
}) => {
  const [state, setRenderedState] = useState<OffcanvasState>({
    primary: null,
    confirmation: null,
  });
  const stateRef = useRef(state);
  const primaryPanelRef = useRef<HTMLDivElement>(null);
  const confirmationPanelRef = useRef<HTMLDivElement>(null);
  const closeTimers = useRef(new Map<string, number>());
  const openFrames = useRef(new Map<string, number>());
  const focusedEntries = useRef(new Set<string>());

  const setState = useCallback((updater: (current: OffcanvasState) => OffcanvasState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setRenderedState(next);
  }, []);

  const transitionToOpen = useCallback((id: string) => {
    const frame = window.requestAnimationFrame(() => {
      openFrames.current.delete(id);
      setState((current) => ({
        primary: current.primary?.id === id
          ? { ...current.primary, phase: 'open' }
          : current.primary,
        confirmation: current.confirmation?.id === id
          ? { ...current.confirmation, phase: 'open' }
          : current.confirmation,
      }));
    });
    openFrames.current.set(id, frame);
  }, [setState]);

  const beginClose = useCallback((
    kind: 'primary' | 'confirmation',
    options: CloseOptions = {},
  ) => {
    const entry = kind === 'primary'
      ? stateRef.current.primary
      : stateRef.current.confirmation;
    if (!entry || entry.phase === 'closing') return;

    const openingFrame = openFrames.current.get(entry.id);
    if (openingFrame !== undefined) {
      window.cancelAnimationFrame(openingFrame);
      openFrames.current.delete(entry.id);
    }
    setState((current) => ({
      ...current,
      [kind]: current[kind] ? { ...current[kind], phase: 'closing' } : null,
    }));

    const timer = window.setTimeout(() => {
      closeTimers.current.delete(entry.id);
      focusedEntries.current.delete(entry.id);
      setState((current) => ({ ...current, [kind]: null }));
      entry.onClosed?.();
      if (options.afterClosed) {
        options.afterClosed();
      } else if (options.restoreTrigger !== false) {
        restoreFocus(entry.triggerElement);
      }
    }, EXIT_DURATION_MS);
    closeTimers.current.set(entry.id, timer);
  }, [setState]);

  const closeConfirmation = useCallback(() => {
    beginClose('confirmation');
  }, [beginClose]);

  const closePrimary = useCallback(() => {
    if (stateRef.current.confirmation) {
      beginClose('confirmation', {
        restoreTrigger: false,
        afterClosed: () => beginClose('primary'),
      });
      return;
    }
    beginClose('primary');
  }, [beginClose]);

  const openConfirmEntry = useCallback((
    config: ConfirmDrawerConfig,
    purpose: ConfirmDrawerEntry['purpose'],
  ): string | null => {
    if (stateRef.current.confirmation) {
      warnStackLimit();
      return null;
    }
    const id = config.id ?? nextDrawerId('confirm');
    const entry: ConfirmDrawerEntry = {
      ...config,
      preventCloseWhileBusy: config.preventCloseWhileBusy ?? true,
      id,
      kind: 'confirm',
      purpose,
      phase: 'opening',
      triggerElement: config.triggerElement ?? activeElement(),
    };
    setState((current) => ({ ...current, confirmation: entry }));
    onDrawerOpen?.();
    transitionToOpen(id);
    return id;
  }, [onDrawerOpen, setState, transitionToOpen]);

  const openConfirm = useCallback((config: ConfirmDrawerConfig): string | null =>
    openConfirmEntry(config, 'action'), [openConfirmEntry]);

  const requestCloseConfirmation = useCallback((reason: OffcanvasCloseReason) => {
    const confirmation = stateRef.current.confirmation;
    if (!confirmation || confirmation.phase === 'closing') return;
    if (confirmation.preventCloseWhileBusy && confirmation.isBusy) return;
    if (reason === 'cancel') confirmation.onCancel?.();
    beginClose('confirmation');
  }, [beginClose]);

  const openUnsavedConfirmation = useCallback(() => {
    openConfirmEntry({
      title: 'Thay đổi chưa được lưu',
      description: 'Bạn có thay đổi chưa được lưu.',
      confirmLabel: 'Bỏ thay đổi',
      cancelLabel: 'Tiếp tục chỉnh sửa',
      variant: 'warning',
      preventCloseWhileBusy: true,
      onConfirm: () => {
        beginClose('confirmation', {
          restoreTrigger: false,
          afterClosed: () => beginClose('primary'),
        });
        return false;
      },
    }, 'unsaved');
  }, [beginClose, openConfirmEntry]);

  const requestClosePrimary = useCallback((reason: OffcanvasCloseReason = 'programmatic') => {
    const primary = stateRef.current.primary;
    if (!primary || primary.phase === 'closing') return;
    if (primary.preventCloseWhileBusy && primary.isBusy) return;
    if (primary.onBeforeClose && !primary.onBeforeClose(reason)) return;
    if (primary.isDirty) {
      openUnsavedConfirmation();
      return;
    }
    beginClose('primary');
  }, [beginClose, openUnsavedConfirmation]);

  const requestCloseTop = useCallback((reason: OffcanvasCloseReason) => {
    if (stateRef.current.confirmation) {
      requestCloseConfirmation(reason);
    } else {
      requestClosePrimary(reason);
    }
  }, [requestCloseConfirmation, requestClosePrimary]);

  const openCrud = useCallback((config: CrudDrawerConfig): string | null => {
    if (stateRef.current.primary || stateRef.current.confirmation) {
      warnStackLimit();
      return null;
    }
    const id = config.id ?? nextDrawerId('crud');
    const entry: CrudDrawerEntry = {
      ...config,
      id,
      kind: 'crud',
      phase: 'opening',
      triggerElement: config.triggerElement ?? activeElement(),
    };
    setState(() => ({ primary: entry, confirmation: null }));
    onDrawerOpen?.();
    transitionToOpen(id);
    return id;
  }, [onDrawerOpen, setState, transitionToOpen]);

  const updatePrimary = useCallback((patch: CrudDrawerUpdate) => {
    setState((current) => ({
      ...current,
      primary: current.primary ? { ...current.primary, ...patch } : null,
    }));
  }, [setState]);

  const updateConfirmationBusy = useCallback((isBusy: boolean) => {
    setState((current) => ({
      ...current,
      confirmation: current.confirmation
        ? { ...current.confirmation, isBusy }
        : null,
    }));
  }, [setState]);

  useBodyScrollLock(
    Boolean(state.primary || state.confirmation),
    'offcanvas-stack',
  );

  const topEntry = state.confirmation ?? state.primary;
  const topPanelRef = state.confirmation ? confirmationPanelRef : primaryPanelRef;

  useEffect(() => {
    if (
      !topEntry
      || topEntry.phase !== 'open'
      || focusedEntries.current.has(topEntry.id)
    ) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const panel = topPanelRef.current;
      if (!panel) return;
      focusedEntries.current.add(topEntry.id);
      const preferred = topEntry.kind === 'crud'
        ? topEntry.initialFocusRef?.current
        : null;
      focusFirstElement(panel, preferred);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [topEntry, topPanelRef]);

  useEffect(() => {
    if (!topEntry) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const panel = topPanelRef.current;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestCloseTop('escape');
      } else if (event.key === 'Tab' && panel) {
        trapTabKey(event, panel);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [requestCloseTop, topEntry, topPanelRef]);

  useEffect(() => () => {
    closeTimers.current.forEach((timer) => window.clearTimeout(timer));
    openFrames.current.forEach((frame) => window.cancelAnimationFrame(frame));
    closeTimers.current.clear();
    openFrames.current.clear();
    focusedEntries.current.clear();
  }, []);

  const value = useMemo<OffcanvasContextValue>(() => ({
    state,
    openCrud,
    openConfirm,
    requestCloseTop,
    requestClosePrimary,
    closePrimary,
    closeConfirmation,
    updatePrimary,
  }), [
    closeConfirmation,
    closePrimary,
    openConfirm,
    openCrud,
    requestClosePrimary,
    requestCloseTop,
    state,
    updatePrimary,
  ]);

  return (
    <OffcanvasContext.Provider value={value}>
      {children}
      {state.primary && (
        <CrudOffcanvas
          entry={state.primary}
          panelRef={primaryPanelRef}
          isTopmost={!state.confirmation}
          onRequestClose={requestClosePrimary}
        />
      )}
      {state.confirmation && (
        <ConfirmOffcanvas
          key={state.confirmation.id}
          entry={state.confirmation}
          panelRef={confirmationPanelRef}
          onRequestClose={requestCloseConfirmation}
          onConfirmed={closeConfirmation}
          onBusyChange={updateConfirmationBusy}
        />
      )}
    </OffcanvasContext.Provider>
  );
};
