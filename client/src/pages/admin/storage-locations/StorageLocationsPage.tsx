import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { listAreas } from '../../../api/areas.service';
import { createStorageLocation, deactivateStorageLocation, listStorageLocations, updateStorageLocation } from '../../../api/storage-locations.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import { ConfirmDialog, CrudFeedbackToast, CrudModal, CrudPageHeader, ErrorState, FieldError, FormActions, inputClassName, labelClassName, LoadingState, RowActions, StatusBadge } from '../../../components/admin/crud/CrudPrimitives';
import { MASTER_DATA_MANAGER_ROLES } from '../../../constants/roles';
import { useAuth } from '../../../context/AuthContext';
import { useCrudResource } from '../../../hooks/useCrudResource';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import type { Area } from '../../../types/areas';
import type { PaginationParams } from '../../../types/pagination.types';
import type { CreateStorageLocationInput, StorageLocation, StorageLocationListParams } from '../../../types/storage-locations';

type StorageLocationQuery = StorageLocationListParams & PaginationParams;

const loadAreas = async () => (await listAreas({ page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' })).data;

const StorageLocationForm = ({ item, areas, areasLoading, areasError, busy, onCancel, onSave }: {
  item: StorageLocation | null;
  areas: Area[];
  areasLoading: boolean;
  areasError: string | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: CreateStorageLocationInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateStorageLocationInput>({
    defaultValues: { code: item?.code ?? '', area_id: item?.area_id ?? '', name: item?.name ?? '', is_active: item?.is_active ?? true },
  });
  const referencesUnavailable = areasLoading || Boolean(areasError) || areas.length === 0;
  return <form onSubmit={handleSubmit(onSave)} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClassName}><span>Khu vực</span>
        <select {...register('area_id', { required: 'Vui lòng chọn khu vực.' })} disabled={areasLoading || Boolean(areasError)} className={inputClassName}>
          <option value="">{areasLoading ? 'Đang tải khu vực...' : 'Chọn khu vực'}</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.code} - {area.name}</option>)}
        </select>
        {areasError ? <FieldError message={`Không tải được khu vực: ${areasError}`} /> : areas.length === 0 && !areasLoading ? <FieldError message="Chưa có khu vực active để lựa chọn." /> : <FieldError message={errors.area_id?.message} />}
      </label>
      <label className={labelClassName}><span>Mã vị trí kho</span><input {...register('code', { required: 'Vui lòng nhập mã vị trí.', setValueAs: (value: string) => value.trim() })} className={inputClassName} /><FieldError message={errors.code?.message} /></label>
    </div>
    <label className={labelClassName}><span>Tên vị trí</span><input {...register('name', { setValueAs: (value: string) => value.trim() || null })} className={inputClassName} /></label>
    <p className="text-xs text-slate-500">Mã vị trí phải duy nhất trong khu vực đã chọn.</p>
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" /> Đang hoạt động</label>
    <FormActions busy={busy || referencesUnavailable} onCancel={onCancel} submitLabel={item ? 'Lưu thay đổi' : 'Tạo vị trí kho'} />
  </form>;
};

const StorageLocationsPage = () => {
  const { role } = useAuth();
  const canMutate = role !== null && MASTER_DATA_MANAGER_ROLES.includes(role);
  const loader = useCallback((query: StorageLocationQuery, signal: AbortSignal) => listStorageLocations(query, signal), []);
  const resource = usePaginatedResource<StorageLocation, StorageLocationQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    loadErrorMessage: 'Không thể tải danh sách vị trí kho.',
  });
  const areas = useCrudResource(loadAreas, 'Không thể tải danh sách khu vực.');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StorageLocation | null>(null);

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resource.query.search) resource.updateQuery({ search });
  }, [debouncedSearch, resource.query.search, resource.updateQuery]);

  const save = async (values: CreateStorageLocationInput) => {
    const ok = await resource.runMutation(
      () => editing ? updateStorageLocation(editing.id, values) : createStorageLocation(values),
      editing ? 'Đã cập nhật vị trí kho.' : 'Đã tạo vị trí kho.',
      editing ? 'Không thể cập nhật vị trí kho.' : 'Không thể tạo vị trí kho.',
    );
    if (ok) setFormOpen(false);
  };

  const columns: Column<StorageLocation>[] = [
    { header: 'Mã', accessor: 'code', sortKey: 'code' },
    { header: 'Tên vị trí', accessor: 'name', sortKey: 'name', render: (item) => item.name || '—' },
    { header: 'Khu vực', accessor: 'area_id', render: (item) => item.area ? `${item.area.code} - ${item.area.name}` : '—' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active} /> },
    ...(canMutate ? [{ header: 'Thao tác', accessor: 'actions', render: (item: StorageLocation) => <RowActions onEdit={() => { setEditing(item); setFormOpen(true); }} onDelete={() => setDeleteTarget(item)} /> }] : []),
  ];

  return <div className="space-y-6">
    <CrudPageHeader title="Storage locations" description="Quản lý vị trí lưu kho theo khu vực." createLabel="Thêm vị trí kho" onCreate={canMutate ? () => { setEditing(null); setFormOpen(true); } : undefined} />
    <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
    {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload} /> : <DataTable
      columns={columns}
      data={resource.items}
      keyExtractor={(item) => item.id}
      searchPlaceholder="Tìm mã hoặc tên vị trí..."
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      pagination={resource.pagination}
      onPageChange={resource.setPage}
      onPageSizeChange={resource.setPageSize}
      sortBy={resource.query.sortBy}
      sortOrder={resource.query.sortOrder}
      onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
      renderTopToolbar={() => <>
        <select value={resource.query.areaId ?? ''} onChange={(event) => resource.updateQuery({ areaId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả khu vực</option>{areas.items.map((area) => <option key={area.id} value={area.id}>{area.code}</option>)}</select>
        <select value={resource.query.isActive === undefined ? '' : String(resource.query.isActive)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === '' ? undefined : event.target.value === 'true' })} className={inputClassName}><option value="">Tất cả trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></select>
      </>}
      emptyText="Không có vị trí kho phù hợp."
    />}
    {formOpen && canMutate && <CrudModal title={editing ? 'Chỉnh sửa vị trí kho' : 'Tạo vị trí kho'} busy={resource.mutating} onClose={() => setFormOpen(false)}><StorageLocationForm key={editing?.id ?? 'create'} item={editing} areas={areas.items} areasLoading={areas.loading} areasError={areas.error} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} /></CrudModal>}
    {deleteTarget && canMutate && <ConfirmDialog title="Ngừng hoạt động vị trí kho?" message={`Vị trí “${deleteTarget.code}” sẽ được chuyển sang inactive nếu không vi phạm ràng buộc dữ liệu.`} confirmLabel="Deactivate" busy={resource.mutating} onCancel={() => setDeleteTarget(null)} onConfirm={() => void resource.runMutation(() => deactivateStorageLocation(deleteTarget.id), 'Đã deactivate vị trí kho.', 'Không thể deactivate vị trí kho.', { removeCurrentItem: resource.query.isActive === true }).then((ok) => { if (ok) setDeleteTarget(null); })} />}
  </div>;
};

export default StorageLocationsPage;
