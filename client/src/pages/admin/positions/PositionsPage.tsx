import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from '../../../api/positions.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import {
  ConfirmDialog, CrudFeedbackToast, CrudModal, CrudPageHeader,
  ErrorState, FieldError, FormActions, inputClassName, labelClassName,
  RowActions,
} from '../../../components/admin/crud/CrudPrimitives';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import { queryKeys } from '../../../lib/queryKeys';
import type { PaginationParams } from '../../../types/pagination.types';
import type { Position, PositionListParams } from '../../../types/positions';

interface PositionFormValues { position_name: string }
type PositionQuery = PositionListParams & PaginationParams;
const initialQuery: PositionQuery = { page: 1, pageSize: 20, sortBy: 'position_name', sortOrder: 'asc' };

const PositionForm = ({ position, busy, onCancel, onSave }: {
  position: Position | null; busy: boolean; onCancel: () => void;
  onSave: (values: PositionFormValues) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<PositionFormValues>({
    defaultValues: { position_name: position?.position_name ?? '' },
  });
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <label className={labelClassName}>
        <span>Tên vị trí công việc</span>
        <input {...register('position_name', { required: 'Vui lòng nhập tên vị trí.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
        <FieldError message={errors.position_name?.message} />
      </label>
      <FormActions busy={busy} onCancel={onCancel} submitLabel={position ? 'Lưu thay đổi' : 'Tạo vị trí'} />
    </form>
  );
};

const PositionsPage = () => {
  const loader = useCallback((query: PositionQuery, signal: AbortSignal) => listPositions(query, signal), []);
  const resource = usePaginatedResource<Position, PositionQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh sách vị trí.',
    queryKey: queryKeys.positions.lists,
    invalidateQueryKeys: [queryKeys.users.all],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  useEffect(() => {
    if ((resourceSearch ?? '') !== debouncedSearch.trim()) updateResourceQuery({ search: debouncedSearch.trim() || undefined });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);
  const [editing, setEditing] = useState<Position | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const save = async (values: PositionFormValues) => {
    const ok = await resource.runMutation(
      () => editing ? updatePosition(editing.id, values) : createPosition(values),
      editing ? 'Đã cập nhật vị trí.' : 'Đã tạo vị trí.',
      editing ? 'Không thể cập nhật vị trí.' : 'Không thể tạo vị trí.',
    );
    if (ok) setFormOpen(false);
  };
  const columns: Column<Position>[] = [
    { header: 'Tên vị trí', accessor: 'position_name', sortKey: 'position_name' },
    { header: 'Thao tác', accessor: 'actions', render: (position) => (
      <RowActions deleteLabel="Xóa" onEdit={() => { setEditing(position); setFormOpen(true); }} onDelete={() => setDeleteTarget(position)} />
    ) },
  ];
  return (
    <div className="space-y-6">
      <CrudPageHeader title="Positions" description="Quản lý danh mục vị trí công việc của người dùng." createLabel="Thêm vị trí" onCreate={() => { setEditing(null); setFormOpen(true); }} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id} searchPlaceholder="Tìm vị trí..." searchValue={search} onSearchChange={setSearch} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có vị trí phù hợp." />}
      {formOpen && <CrudModal title={editing ? 'Chỉnh sửa vị trí' : 'Tạo vị trí'} busy={resource.mutating} onClose={() => setFormOpen(false)}><PositionForm key={editing?.id ?? 'create'} position={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} /></CrudModal>}
      {deleteTarget && <ConfirmDialog title="Xóa vị trí?" message={`Vị trí “${deleteTarget.position_name}” chỉ được xóa khi chưa được sử dụng.`} confirmLabel="Xóa vị trí" busy={resource.mutating} onCancel={() => setDeleteTarget(null)} onConfirm={() => void resource.runMutation(() => deletePosition(deleteTarget.id), 'Đã xóa vị trí.', 'Không thể xóa vị trí.', { removeCurrentItem: true }).then((ok) => { if (ok) setDeleteTarget(null); })} />}
    </div>
  );
};

export default PositionsPage;
