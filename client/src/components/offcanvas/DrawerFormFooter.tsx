import type { ReactNode } from 'react';
import { InfoButton, SecondaryButton } from '../common/Button';

interface DrawerFormFooterProps {
  cancelLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  formId?: string;
  onCancel: () => void;
  onSubmit?: () => void;
  secondaryAction?: ReactNode;
  showSubmit?: boolean;
}

export const DrawerFormFooter = ({
  cancelLabel = 'Bỏ qua',
  submitLabel = 'Lưu',
  submittingLabel = 'Đang lưu...',
  isSubmitting = false,
  isDisabled = false,
  formId,
  onCancel,
  onSubmit,
  secondaryAction,
  showSubmit = true,
}: DrawerFormFooterProps) => (
  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
    {secondaryAction}
    <button
      type="button"
      disabled={isSubmitting}
      onClick={onCancel}
      className={`${SecondaryButton} min-h-11 w-full sm:w-auto`}
    >
      {cancelLabel}
    </button>
    {showSubmit && (
      <button
        type={formId ? 'submit' : 'button'}
        form={formId}
        disabled={isSubmitting || isDisabled}
        onClick={formId ? undefined : onSubmit}
        className={`${InfoButton} min-h-11 w-full sm:w-auto`}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    )}
  </div>
);
