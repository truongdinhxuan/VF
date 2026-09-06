import { useForm } from 'react-hook-form';
import { CrudDrawerForm } from '../crud/CrudDrawerForm';
import { FieldError, inputClassName, labelClassName } from '../crud/CrudPrimitives';
import type { Area, CreateAreaInput } from '../../types/areas';

export const AreaForm = ({ area, busy, onSave }: {
  area: Area | null; busy: boolean;
  onSave: (values: CreateAreaInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<CreateAreaInput>({
    defaultValues: {
      code: area?.code ?? '',
      name: area?.name ?? '',
      description: area?.description ?? '',
      is_active: area?.is_active ?? true,
    },
  });
  return (
    <CrudDrawerForm isDirty={isDirty} busy={busy} submitLabel={area ? 'Lưu thay đổi' : 'Tạo khu vực'} onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          <span>Mã khu vực</span>
          <input {...register('code', { required: 'Vui lòng nhập mã khu vực.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
          <FieldError message={errors.code?.message} />
        </label>
        <label className={labelClassName}>
          <span>Tên khu vực</span>
          <input {...register('name', { required: 'Vui lòng nhập tên khu vực.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
          <FieldError message={errors.name?.message} />
        </label>
      </div>
      <label className={labelClassName}>
        <span>Mô tả</span>
        <textarea
          rows={3}
          {...register('description', {
            setValueAs: (value: string) => value.trim() || null,
          })}
          className={inputClassName}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" /> Đang hoạt động
      </label>

    </CrudDrawerForm>
  );
};
