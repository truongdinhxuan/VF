import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { createArea, deactivateArea, listAreas, updateArea } from '../../../api/areas.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import {
  ConfirmDialog, CrudFeedbackToast, CrudModal, CrudPageHeader,
  ErrorState, FieldError, FormActions, inputClassName, labelClassName,
  LoadingState, RowActions, StatusBadge,
} from '../../../components/admin/crud/CrudPrimitives';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import type { Area, AreaListParams, CreateAreaInput } from '../../../types/areas';
import type { PaginationParams } from '../../../types/pagination.types';

type AreaQuery = AreaListParams & PaginationParams;
const initialQuery: AreaQuery = { page: 1, pageSize: 20, isActive: true, sortBy: 'code', sortOrder: 'asc' };

const AreaForm = ({ area, busy, onCancel, onSave }: {
  area: Area | null; busy: boolean; onCancel: () => void;
  onSave: (values: CreateAreaInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateAreaInput>({
    defaultValues: { code: area?.code ?? '', name: area?.name ?? '', is_active: area?.is_active ?? true },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
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
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" /> Đang hoạt động
      </label>
      <FormActions busy={busy} onCancel={onCancel} submitLabel={area ? 'Lưu thay đổi' : 'Tạo khu vực'} />
    </form>
  );
};

const AreasPage = () => {
  const loader = useCallback((query: AreaQuery, signal: AbortSignal) => listAreas(query, signal), []);
  const resource = usePaginatedResource<Area, AreaQuery>({ loader, initialQuery, loadErrorMessage: 'Không thể tải danh sách khu vực.' });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  useEffect(() => {
    if ((resource.query.search ?? '') !== debouncedSearch.trim()) resource.updateQuery({ search: debouncedSearch.trim() || undefined });
  }, [debouncedSearch, resource.query.search, resource.updateQuery]);
  const [editing, setEditing] = useState<Area | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null);
  const save = async (values: CreateAreaInput) => {
    const ok = await resource.runMutation(
      () => editing ? updateArea(editing.id, values) : createArea(values),
      editing ? 'Đã cập nhật khu vực.' : 'Đã tạo khu vực.',
      editing ? 'Không thể cập nhật khu vực.' : 'Không thể tạo khu vực.',
    );
    if (ok) setFormOpen(false);
  };
  const columns: Column<Area>[] = [
    { header: 'Mã', accessor: 'code', sortKey: 'code' }, { header: 'Tên khu vực', accessor: 'name', sortKey: 'name' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (area) => <StatusBadge active={area.is_active} /> },
    { header: 'Thao tác', accessor: 'actions', render: (area) => <RowActions onEdit={() => { setEditing(area); setFormOpen(true); }} onDelete={() => setDeleteTarget(area)} /> },
  ];
  return (
    <div className="space-y-6">
      <CrudPageHeader title="Areas" description="Quản lý khu vực và mã khu vực duy nhất." createLabel="Thêm khu vực" onCreate={() => { setEditing(null); setFormOpen(true); }} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : <DataTable columns={columns} data={resource.items} keyExtractor={(item) => item.id} searchPlaceholder="Tìm mã hoặc tên khu vực..." searchValue={search} onSearchChange={setSearch} renderTopToolbar={() => <select value={String(resource.query.isActive ?? true)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })} className={inputClassName}><option value="true">Active</option><option value="false">Inactive</option></select>} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có khu vực phù hợp." />}
      {formOpen && <CrudModal title={editing ? 'Chỉnh sửa khu vực' : 'Tạo khu vực'} busy={resource.mutating} onClose={() => setFormOpen(false)}><AreaForm key={editing?.id ?? 'create'} area={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} /></CrudModal>}
      {deleteTarget && <ConfirmDialog title="Ngừng hoạt động khu vực?" message={`Khu vực “${deleteTarget.name}” sẽ được chuyển sang trạng thái inactive, không xóa cứng.`} confirmLabel="Deactivate" busy={resource.mutating} onCancel={() => setDeleteTarget(null)} onConfirm={() => void resource.runMutation(() => deactivateArea(deleteTarget.id), 'Đã deactivate khu vực.', 'Không thể deactivate khu vực.', { removeCurrentItem: resource.query.isActive === true }).then((ok) => { if (ok) setDeleteTarget(null); })} />}
    </div>
  );
};
export default AreasPage;
