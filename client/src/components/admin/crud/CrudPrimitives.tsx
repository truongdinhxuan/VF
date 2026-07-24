import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import {useEffect} from 'react';
import type { CrudFeedback } from '../../../hooks/useCrudResource';
import { AnimatePresence, motion } from 'motion/react';

export const inputClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export const labelClassName =
  'block space-y-1.5 text-sm font-semibold text-slate-700';

const renderPortal = (children: ReactNode) => {
  if (typeof document === 'undefined') return null;

  return createPortal(children, document.body);
};

export const CrudPageHeader = ({
  title,
  description,
  onCreate,
  createLabel = 'Thêm mới',
}: {
  title: string;
  description: string;
  onCreate?: () => void;
  createLabel?: string;
}) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
        Master data
      </p>

      <h1 className="mt-1 break-words text-2xl font-bold text-slate-900">
        {title}
      </h1>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>

    {onCreate && (
      <button
        type="button"
        onClick={onCreate}
        className="w-full shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
      >
        {createLabel}
      </button>
    )}
  </div>
);

export const CrudFeedbackToast = ({
  feedback,
  onClose,
}: {
  feedback: CrudFeedback | null;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!feedback) return;

    const timeout = window.setTimeout(onClose, 3000);

    return () => window.clearTimeout(timeout);
  }, [feedback, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {feedback && (
        <motion.div
          key={`${feedback.type}-${feedback.message}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{
            duration: 0.25,
            ease: 'easeOut',
          }}
          className={`fixed inset-x-0 top-0 z-[100] flex w-full items-start justify-between gap-3 border-b px-4 py-3 text-sm shadow-xl
            md:inset-x-auto md:right-6 md:top-6 md:w-auto md:max-w-md md:rounded-xl md:border
            ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
        >
          <span className="min-w-0 flex-1 break-words font-medium">
            {feedback.message}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-1 text-lg font-bold leading-none opacity-70 hover:opacity-100"
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export const LoadingState = ({
  label = 'Đang tải dữ liệu...',
}: {
  label?: string;
}) => (
  <div
    role="status"
    aria-live="polite"
    className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm sm:p-10"
  >
    {label}
  </div>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div
    role="alert"
    className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:p-8"
  >
    <p className="break-words text-sm font-semibold text-rose-700">
      {message}
    </p>

    <button
      type="button"
      onClick={onRetry}
      className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Thử lại
    </button>
  </div>
);

export const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 sm:p-10">
    {label}
  </div>
);

export const CrudModal = ({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) =>
  renderPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crud-modal-title"
        className="my-auto max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2
            id="crud-modal-title"
            className="min-w-0 break-words text-lg font-bold text-slate-900"
          >
            {title}
          </h2>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng cửa sổ"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-4 sm:max-h-[calc(90vh-4.5rem)] sm:p-5">
          {children}
        </div>
      </div>
    </div>,
  );

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Xác nhận',
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) =>
  renderPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5"
      >
        <h2
          id="confirm-dialog-title"
          className="break-words text-lg font-bold text-slate-900"
        >
          {title}
        </h2>

        <p
          id="confirm-dialog-description"
          className="mt-2 break-words text-sm leading-6 text-slate-600"
        >
          {message}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Bỏ qua
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
  );

export const StatusBadge = ({ active }: { active: boolean }) => (
  <span
    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
      active
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-500'
    }`}
  >
    {active ? 'Active' : 'Inactive'}
  </span>
);

export const RowActions = ({
  onEdit,
  onDelete,
  deleteLabel = 'Deactivate',
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) => (
  <div className="flex flex-wrap justify-end gap-x-3 gap-y-2">
    <button
      type="button"
      onClick={onEdit}
      className="whitespace-nowrap rounded-md px-1 py-0.5 font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Sửa
    </button>

    <button
      type="button"
      onClick={onDelete}
      className="whitespace-nowrap rounded-md px-1 py-0.5 font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
    >
      {deleteLabel}
    </button>
  </div>
);

export const FormActions = ({
  busy,
  onCancel,
  submitLabel,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
}) => (
  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
    <button
      type="button"
      disabled={busy}
      onClick={onCancel}
      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      Bỏ qua
    </button>

    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {busy ? 'Đang lưu...' : submitLabel}
    </button>
  </div>
);

export const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="text-xs font-medium text-rose-600">
      {message}
    </p>
  ) : null;