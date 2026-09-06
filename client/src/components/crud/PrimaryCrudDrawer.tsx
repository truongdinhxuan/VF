import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import type { CrudOffcanvasMode, OffcanvasSize } from '../../types/offcanvas.types';
import { DrawerFormFooter } from '../offcanvas/DrawerFormFooter';
import { PrimaryCrudContext } from './PrimaryCrudContext';

/** Declarative adapter for the existing host. Portals keep the caller's form
 * mounted during query refreshes without copying business state into the host. */
export const PrimaryCrudDrawer = ({
  title, mode, children, onClose, onEdit, busy = false, error, size = 'md',
}: {
  title: string;
  mode: CrudOffcanvasMode;
  children: ReactNode;
  onClose: () => void;
  onEdit?: () => void;
  busy?: boolean;
  error?: string | null;
  size?: OffcanvasSize;
}) => {
  const { openCrud, updatePrimary, closePrimary, requestClosePrimary } = useCrudOffcanvas();
  const formId = useId();
  const [bodyTarget, setBodyTarget] = useState<HTMLDivElement | null>(null);
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setRenderedPending] = useState(false);
  const errorElement = useRef<HTMLParagraphElement>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(false);
  const drawerId = useRef<string | null>(null);
  const onClosedRef = useRef(onClose);
  useLayoutEffect(() => { onClosedRef.current = onClose; }, [onClose]);
  const setPending = useCallback((value: boolean) => {
    pendingRef.current = value;
    setRenderedPending(value);
  }, []);
  const requestClose = useCallback(() => requestClosePrimary('cancel'), [requestClosePrimary]);

  useLayoutEffect(() => {
    mounted.current = true;
    if (!drawerId.current) {
      drawerId.current = openCrud({
        title, mode, size,
        content: <div ref={setBodyTarget} />,
        footer: <div ref={setFooterTarget} />,
        preventCloseWhileBusy: true,
        onBeforeClose: () => !pendingRef.current,
        onClosed: () => { drawerId.current = null; onClosedRef.current(); },
      });
    }
    return () => {
      mounted.current = false;
      // React StrictMode replays effects without actually abandoning the drawer.
      queueMicrotask(() => {
        if (!mounted.current && drawerId.current) closePrimary();
      });
    };
  }, [closePrimary, mode, openCrud, size, title]);

  useEffect(() => {
    updatePrimary({ title, mode, size, isDirty: mode !== 'view' && dirty, isBusy: busy || pending });
  }, [busy, dirty, mode, pending, size, title, updatePrimary]);

  useEffect(() => {
    // Long forms may be scrolled to the footer when the server rejects a save.
    // Bring the persistent inline error into view without resetting form values.
    if (error) errorElement.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  const context = useMemo(() => ({ formId, footerTarget, setDirty, setPending, requestClose }),
    [formId, footerTarget, requestClose, setPending]);
  return <PrimaryCrudContext.Provider value={context}>
    {bodyTarget && createPortal(<>
      {error && <p ref={errorElement} role="alert" className="mb-4 break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {children}
    </>, bodyTarget)}
    {mode === 'view' && footerTarget && createPortal(
      <DrawerFormFooter cancelLabel="Đóng" submitLabel="Chỉnh sửa" showSubmit={Boolean(onEdit)} onCancel={requestClose} onSubmit={onEdit} />,
      footerTarget,
    )}
  </PrimaryCrudContext.Provider>;
};
