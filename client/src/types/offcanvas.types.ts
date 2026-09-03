import type { ReactNode, RefObject } from 'react';

export type OffcanvasSize = 'sm' | 'md' | 'lg' | 'full';
export type CrudOffcanvasMode = 'create' | 'edit' | 'view';
export type ConfirmOffcanvasVariant = 'default' | 'warning' | 'danger';
export type OffcanvasCloseReason =
  | 'close-button'
  | 'escape'
  | 'backdrop'
  | 'cancel'
  | 'programmatic';
export type DrawerPhase = 'opening' | 'open' | 'closing';

export interface CrudDrawerConfig {
  id?: string;
  mode: CrudOffcanvasMode;
  title: string;
  description?: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
  size?: OffcanvasSize;
  isDirty?: boolean;
  isBusy?: boolean;
  preventCloseWhileBusy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  triggerElement?: HTMLElement | null;
  onBeforeClose?: (reason: OffcanvasCloseReason) => boolean;
  onClosed?: () => void;
}

export interface ConfirmDrawerConfig {
  id?: string;
  title: string;
  description?: ReactNode;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmOffcanvasVariant;
  size?: Extract<OffcanvasSize, 'sm' | 'md'>;
  isBusy?: boolean;
  preventCloseWhileBusy?: boolean;
  triggerElement?: HTMLElement | null;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onCancel?: () => void;
  onClosed?: () => void;
}

export interface CrudDrawerEntry extends Omit<CrudDrawerConfig, 'id'> {
  id: string;
  kind: 'crud';
  phase: DrawerPhase;
  triggerElement: HTMLElement | null;
}

export interface ConfirmDrawerEntry extends Omit<ConfirmDrawerConfig, 'id'> {
  id: string;
  kind: 'confirm';
  phase: DrawerPhase;
  triggerElement: HTMLElement | null;
  purpose: 'action' | 'unsaved';
}

export interface OffcanvasState {
  primary: CrudDrawerEntry | null;
  confirmation: ConfirmDrawerEntry | null;
}

export type CrudDrawerUpdate = Partial<Pick<
  CrudDrawerConfig,
  | 'mode'
  | 'title'
  | 'description'
  | 'content'
  | 'footer'
  | 'size'
  | 'isDirty'
  | 'isBusy'
  | 'preventCloseWhileBusy'
  | 'initialFocusRef'
  | 'onBeforeClose'
>>;

export interface OffcanvasContextValue {
  state: OffcanvasState;
  openCrud: (config: CrudDrawerConfig) => string | null;
  openConfirm: (config: ConfirmDrawerConfig) => string | null;
  requestCloseTop: (reason: OffcanvasCloseReason) => void;
  requestClosePrimary: (reason?: OffcanvasCloseReason) => void;
  closePrimary: () => void;
  closeConfirmation: () => void;
  updatePrimary: (patch: CrudDrawerUpdate) => void;
}
