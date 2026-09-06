import { createContext } from 'react';

export interface PrimaryCrudFormContext {
  formId: string;
  footerTarget: HTMLDivElement | null;
  setDirty: (dirty: boolean) => void;
  setPending: (pending: boolean) => void;
  requestClose: () => void;
}

export const PrimaryCrudContext = createContext<PrimaryCrudFormContext | null>(null);
