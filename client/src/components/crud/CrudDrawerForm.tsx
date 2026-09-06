import { useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DrawerFormFooter } from '../offcanvas/DrawerFormFooter';
import { PrimaryCrudContext } from './PrimaryCrudContext';

/** UI lifecycle only: validation, payload, mutation and invalidation stay with the caller. */
export const CrudDrawerForm = ({ children, onSubmit, isDirty, busy = false, submitDisabled = false, submitLabel = 'Lưu', className = 'space-y-4' }: {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isDirty: boolean;
  busy?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  className?: string;
}) => {
  const context = useContext(PrimaryCrudContext);
  if (!context) throw new Error('CrudDrawerForm requires PrimaryCrudDrawer');
  const { formId, footerTarget, setDirty, setPending, requestClose } = context;
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setDirty(isDirty); }, [isDirty, setDirty]);
  useEffect(() => {
    const field = formRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    if (field) {
      field.dataset.autofocus = 'true';
      field.focus({ preventScroll: true });
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy || submitDisabled) return;
    submittingRef.current = true;
    setSubmitting(true);
    setPending(true);
    try {
      await onSubmit(event);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setPending(false);
    }
  };
  return <>
    <form ref={formRef} id={formId} onSubmit={submit} className={className} noValidate aria-busy={busy || submitting}>
      <fieldset disabled={busy} className="min-w-0 space-y-4">{children}</fieldset>
    </form>
    {footerTarget && createPortal(<DrawerFormFooter formId={formId} submitLabel={submitLabel} isSubmitting={busy || submitting} isDisabled={submitDisabled} onCancel={requestClose} />, footerTarget)}
  </>;
};
