import { useCallback, useContext } from 'react';
import { OffcanvasContext } from '../components/offcanvas/OffcanvasContext';
import type {
  ConfirmDrawerConfig,
  CrudDrawerConfig,
  OffcanvasContextValue,
} from '../types/offcanvas.types';

export const useCrudOffcanvas = () => {
  const context = useContext(OffcanvasContext);
  if (!context) {
    throw new Error('useCrudOffcanvas must be used within OffcanvasProvider');
  }

  const { openCrud, openConfirm: openConfirmDrawer } = context;

  const openCreate = useCallback((config: Omit<CrudDrawerConfig, 'mode'>) =>
    openCrud({ ...config, mode: 'create' }), [openCrud]);
  const openEdit = useCallback((config: Omit<CrudDrawerConfig, 'mode'>) =>
    openCrud({ ...config, mode: 'edit' }), [openCrud]);
  const openView = useCallback((config: Omit<CrudDrawerConfig, 'mode'>) =>
    openCrud({ ...config, mode: 'view' }), [openCrud]);
  const openConfirm = useCallback((config: ConfirmDrawerConfig) =>
    openConfirmDrawer(config), [openConfirmDrawer]);

  return {
    ...context,
    openCreate,
    openEdit,
    openView,
    openConfirm,
  } satisfies OffcanvasContextValue & {
    openCreate: typeof openCreate;
    openEdit: typeof openEdit;
    openView: typeof openView;
  };
};
