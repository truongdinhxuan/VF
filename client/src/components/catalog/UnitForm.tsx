import { useCallback, useEffect, useRef, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import {
  FieldError,
  inputClassName,
  labelClassName,
} from '../crud/CrudPrimitives';
import type { CreateUnitInput, Unit } from '../../types/units';

export interface UnitFormProps {
  formId: string;
  item: Unit | null;
  serverError?: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmittingChange: (submitting: boolean) => void;
  onSave: (values: CreateUnitInput) => Promise<boolean>;
}

export const UnitForm = ({
  formId,
  item,
  serverError,
  onDirtyChange,
  onSubmittingChange,
  onSave,
}: UnitFormProps) => {
  const submittingRef = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CreateUnitInput>({
    defaultValues: {
      code: item?.code ?? '',
      symbol: item?.symbol ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      is_active: item?.is_active ?? true,
    },
    shouldFocusError: true,
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const validateAndSave = handleSubmit(async (values) => {
    onSubmittingChange(true);
    try {
      await onSave({
        ...values,
        description: values.description?.trim() || null,
      });
    } finally {
      onSubmittingChange(false);
    }
  });
  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    if (submittingRef.current) {
      event.preventDefault();
      return;
    }
    submittingRef.current = true;
    try {
      await validateAndSave(event);
    } finally {
      submittingRef.current = false;
    }
  }, [validateAndSave]);

  return (
    <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
      {serverError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {serverError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          <span>Mã đơn vị</span>
          <input
            data-autofocus="true"
            {...register('code', {
              required: 'Vui lòng nhập mã đơn vị.',
              setValueAs: (value: string) => value.trim(),
            })}
            className={inputClassName}
          />
          <FieldError message={errors.code?.message} />
        </label>

        <label className={labelClassName}>
          <span>Ký hiệu</span>
          <input
            {...register('symbol', {
              required: 'Vui lòng nhập ký hiệu.',
              setValueAs: (value: string) => value.trim(),
            })}
            className={inputClassName}
          />
          <FieldError message={errors.symbol?.message} />
        </label>
      </div>

      <label className={labelClassName}>
        <span>Tên đơn vị</span>
        <input
          {...register('name', {
            required: 'Vui lòng nhập tên đơn vị.',
            setValueAs: (value: string) => value.trim(),
          })}
          className={inputClassName}
        />
        <FieldError message={errors.name?.message} />
      </label>

      <label className={labelClassName}>
        <span>Mô tả</span>
        <textarea
          rows={4}
          {...register('description', {
            setValueAs: (value: string) => value.trim(),
          })}
          className={inputClassName}
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          {...register('is_active')}
          className="h-4 w-4 rounded border-slate-300"
        />
        Đang hoạt động
      </label>
    </form>
  );
};
