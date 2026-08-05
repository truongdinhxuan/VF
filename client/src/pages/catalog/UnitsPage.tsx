import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { createUnit, deactivateUnit, listUnits, updateUnit } from '../../api/units.service';
import { DataTable, type Column } from '../../components/common/DataTable';
import {
  ConfirmDialog,
  CrudFeedbackToast,
  CrudModal,
  CrudPageHeader,
  ErrorState,
  FieldError,
  FormActions,
  inputClassName,
  labelClassName,
  RowActions,
  StatusBadge,
} from '../../components/crud/CrudPrimitives';
import { MASTER_DATA_MANAGER_ROLES } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { PaginationParams } from '../../types/pagination.types';
import type { CreateUnitInput, Unit, UnitListParams } from '../../types/units';

type UnitQuery = UnitListParams & PaginationParams;
const initialQuery: UnitQuery = {
  page: 1,
  pageSize: 20,
  isActive: true,
  sortBy: 'code',
  sortOrder: 'asc',
};

const UnitForm = ({ item, busy, onCancel, onSave }: {
  item: Unit | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: CreateUnitInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateUnitInput>({
    defaultValues: {
      code: item?.code ?? '',
      symbol: item?.symbol ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      is_active: item?.is_active ?? true,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          <span>Mã đơn vị</span>
          <input {...register('code', { required: 'Vui lòng nhập mã đơn vị.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
          <FieldError message={errors.code?.message} />
        </label>
        <label className={labelClassName}>
          <span>Ký hiệu</span>
          <input {...register('symbol', { required: 'Vui lòng nhập ký hiệu.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
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
          rows={3}
          {...register('description', {
            setValueAs: (value: string) => value.trim() || null,
          })}
          className={inputClassName}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" />
        Đang hoạt động
      </label>
      <FormActions busy={busy} onCancel={onCancel} submitLabel={item ? 'Lưu thay đổi' : 'Tạo đơn vị'} />
    </form>
  );
};

const UnitsPage = () => {
  const { role } = useAuth();
  const canMutate = role !== null && MASTER_DATA_MANAGER_ROLES.includes(role);
  const loader = useCallback((query: UnitQuery, signal: AbortSignal) => listUnits(query, signal), []);
  const resource = usePaginatedResource<Unit, UnitQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh sách đơn vị.',
    queryKey: queryKeys.units.lists,
    invalidateQueryKeys: [queryKeys.supplies.all],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const [editing, setEditing] = useState<Unit | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  useEffect(() => {
    const nextSearch = debouncedSearch.trim() || undefined;
    if (resourceSearch !== nextSearch) updateResourceQuery({ search: nextSearch });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: CreateUnitInput) => {
    const ok = await resource.runMutation(
      () => editing ? updateUnit(editing.id, values) : createUnit(values),
      editing ? 'Đã cập nhật đơn vị.' : 'Đã tạo đơn vị.',
      editing ? 'Không thể cập nhật đơn vị.' : 'Không thể tạo đơn vị.',
    );
    if (ok) setFormOpen(false);
  };

  const columns: Column<Unit>[] = [
    { header: 'Mã', accessor: 'code', sortKey: 'code' },
    { header: 'Ký hiệu', accessor: 'symbol', sortKey: 'symbol' },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active} /> },
    ...(canMutate ? [{
      header: 'Thao tác',
      accessor: 'actions',
      render: (item: Unit) => <RowActions onEdit={() => { setEditing(item); setFormOpen(true); }} onDelete={() => setDeleteTarget(item)} />,
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader title="Units" description="Quản lý đơn vị tính dùng cho vật tư." createLabel="Thêm đơn vị" onCreate={canMutate ? () => { setEditing(null); setFormOpen(true); } : undefined} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id} searchPlaceholder="Tìm mã hoặc ký hiệu..." searchValue={search} onSearchChange={setSearch} renderTopToolbar={() => <select value={String(resource.query.isActive ?? true)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })} className={inputClassName}><option value="true">Active</option><option value="false">Inactive</option></select>} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có đơn vị phù hợp." />
      )}
      {formOpen && canMutate && <CrudModal title={editing ? 'Chỉnh sửa đơn vị' : 'Tạo đơn vị'} busy={resource.mutating} onClose={() => setFormOpen(false)}><UnitForm key={editing?.id ?? 'create'} item={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} /></CrudModal>}
      {deleteTarget && canMutate && <ConfirmDialog title="Ngừng hoạt động đơn vị?" message={`Đơn vị “${deleteTarget.symbol}” sẽ được chuyển sang inactive nếu chưa bị ràng buộc.`} confirmLabel="Deactivate" busy={resource.mutating} onCancel={() => setDeleteTarget(null)} onConfirm={() => void resource.runMutation(() => deactivateUnit(deleteTarget.id), 'Đã deactivate đơn vị.', 'Không thể deactivate đơn vị.', { removeCurrentItem: resource.query.isActive === true }).then((ok) => { if (ok) setDeleteTarget(null); })} />}
    </div>
  );
};

export default UnitsPage;
