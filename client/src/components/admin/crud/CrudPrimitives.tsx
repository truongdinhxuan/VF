import type { ReactNode } from 'react';
import type { CrudFeedback } from '../../../hooks/useCrudResource';

export const inputClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100';

export const labelClassName = 'space-y-1.5 text-sm font-semibold text-slate-700';

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
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Master data</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
    {onCreate && (
      <button
        type="button"
        onClick={onCreate}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
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
  if (!feedback) return null;
  const success = feedback.type === 'success';
  return (
    <div
      role="status"
      className={`fixed right-5 top-5 z-[80] flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
        success
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      <span className="font-medium">{feedback.message}</span>
      <button type="button" onClick={onClose} className="font-bold" aria-label="Đóng thông báo">
        ×
      </button>
    </div>
  );
};

export const LoadingState = ({ label = 'Đang tải dữ liệu...' }: { label?: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
    {label}
  </div>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
    <p className="text-sm font-semibold text-rose-700">{message}</p>
    <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
      Thử lại
    </button>
  </div>
);

export const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
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
}) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">
          ×
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
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
}) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
    <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
          Bỏ qua
        </button>
        <button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          {busy ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
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
  <div className="flex justify-end gap-3 whitespace-nowrap">
    <button type="button" onClick={onEdit} className="font-semibold text-blue-600 hover:text-blue-800">
      Sửa
    </button>
    <button type="button" onClick={onDelete} className="font-semibold text-rose-600 hover:text-rose-800">
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
  <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
    <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
      Bỏ qua
    </button>
    <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
      {busy ? 'Đang lưu...' : submitLabel}
    </button>
  </div>
);

export const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-xs font-medium text-rose-600">{message}</p> : null;
