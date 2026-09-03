import type { RefObject } from 'react';
import type { CrudDrawerEntry, OffcanvasCloseReason } from '../../types/offcanvas.types';
import { Offcanvas } from './Offcanvas';

export const CrudOffcanvas = ({
  entry,
  panelRef,
  isTopmost,
  onRequestClose,
}: {
  entry: CrudDrawerEntry;
  panelRef: RefObject<HTMLDivElement | null>;
  isTopmost: boolean;
  onRequestClose: (reason: OffcanvasCloseReason) => void;
}) => (
  <Offcanvas
    id={entry.id}
    phase={entry.phase}
    layer="primary"
    role="dialog"
    title={entry.title}
    description={entry.description}
    footer={entry.footer}
    size={entry.size ?? 'md'}
    isTopmost={isTopmost}
    busy={Boolean(entry.isBusy && entry.preventCloseWhileBusy)}
    panelRef={panelRef}
    onRequestClose={onRequestClose}
  >
    {entry.content}
  </Offcanvas>
);

