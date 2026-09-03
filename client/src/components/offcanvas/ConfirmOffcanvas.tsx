import { useState, type RefObject } from 'react';
import type {
  ConfirmDrawerEntry,
  OffcanvasCloseReason,
} from '../../types/offcanvas.types';
import {
  ErrorButton,
  InfoButton,
  SecondaryButton,
  WarningButton,
} from '../common/Button';
import { Offcanvas } from './Offcanvas';

const buttonClassByVariant = {
  default: InfoButton,
  warning: WarningButton,
  danger: ErrorButton,
} as const;

export const ConfirmOffcanvas = ({
  entry,
  panelRef,
  onRequestClose,
  onConfirmed,
  onBusyChange,
}: {
  entry: ConfirmDrawerEntry;
  panelRef: RefObject<HTMLDivElement | null>;
  onRequestClose: (reason: OffcanvasCloseReason) => void;
  onConfirmed: () => void;
  onBusyChange: (busy: boolean) => void;
}) => {
  const [pending, setPending] = useState(false);
  const busy = Boolean(entry.isBusy || pending);

  const confirm = async () => {
    if (busy) return;
    setPending(true);
    onBusyChange(true);
    try {
      const result = await entry.onConfirm();
      if (result !== false) onConfirmed();
    } finally {
      onBusyChange(false);
      setPending(false);
    }
  };

  const cancel = () => {
    if (busy && entry.preventCloseWhileBusy) return;
    onRequestClose('cancel');
  };

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        disabled={busy}
        onClick={cancel}
        className={`${SecondaryButton} min-h-11 w-full sm:w-auto`}
      >
        {entry.cancelLabel ?? 'Bỏ qua'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void confirm()}
        className={`${buttonClassByVariant[entry.variant ?? 'default']} min-h-11 w-full sm:w-auto`}
      >
        {pending ? 'Đang xử lý...' : entry.confirmLabel ?? 'Xác nhận'}
      </button>
    </div>
  );

  return (
    <Offcanvas
      id={entry.id}
      phase={entry.phase}
      layer="confirmation"
      role="alertdialog"
      title={entry.title}
      description={entry.description}
      footer={footer}
      size={entry.size ?? 'sm'}
      isTopmost
      busy={Boolean(busy && entry.preventCloseWhileBusy)}
      panelRef={panelRef}
      onRequestClose={onRequestClose}
    >
      {entry.content}
    </Offcanvas>
  );
};
