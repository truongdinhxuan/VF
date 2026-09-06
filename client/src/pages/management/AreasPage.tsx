import { useCallback,useEffect,useState,type MouseEvent } from 'react';
import { createArea,deactivateArea,listAreas,updateArea } from '../../api/areas.service';
import { DataTable,type Column } from '../../components/common/DataTable';
import { CrudEntityView } from '../../components/crud/CrudEntityView';
import {
CrudFeedbackToast,
CrudPageHeader,
ErrorState,
inputClassName,
RowActions,StatusBadge
} from '../../components/crud/CrudPrimitives';
import { PrimaryCrudDrawer } from '../../components/crud/PrimaryCrudDrawer';
import { AreaForm } from '../../components/forms/AreaForm';
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { Area,AreaListParams,CreateAreaInput } from '../../types/areas';
import type { PaginationParams } from '../../types/pagination.types';

type AreaQuery = AreaListParams & PaginationParams;
const initialQuery: AreaQuery = { page: 1, pageSize: 20, isActive: true, sortBy: 'code', sortOrder: 'asc' };

const AreasPage = () => {
  const { openConfirm } = useCrudOffcanvas();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE);
  const canUpdate = hasPermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE);
  const canDelete = hasPermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE);
  const hasActions = true; // Read access is already enforced by the page guard.
  const loader = useCallback((query: AreaQuery, signal: AbortSignal) => listAreas(query, signal), []);
  const resource = usePaginatedResource<Area, AreaQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh sách khu vực.',
    queryKey: queryKeys.areas.lists,
    invalidateQueryKeys: [queryKeys.storageLocations.all, queryKeys.users.all],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  useEffect(() => {
    if ((resourceSearch ?? '') !== debouncedSearch.trim()) updateResourceQuery({ search: debouncedSearch.trim() || undefined });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);
  const [editing, setEditing] = useState<Area | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const openView = useCallback((item: Area) => {
    setEditing(item); setViewing(true); setFormError(null); setFormOpen(true);
  }, []);
  const save = async (values: CreateAreaInput) => {
    setFormError(null);
    try {
      const ok = await resource.runMutation(
        () => editing ? updateArea(editing.id, values) : createArea(values),
        editing ? 'Đã cập nhật khu vực.' : 'Đã tạo khu vực.',
        editing ? 'Không thể cập nhật khu vực.' : 'Không thể tạo khu vực.',
        { throwOnError: true },
      );
      if (ok) setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại.');
    }
  };
  const confirmDeactivate = (area: Area, event: MouseEvent<HTMLButtonElement>) => openConfirm({
    title: 'Ngừng sử dụng khu vực?',
    description: `Khu vực “${area.name}” sẽ được chuyển sang trạng thái inactive, không xóa cứng.`,
    confirmLabel: 'Ngừng sử dụng',
    cancelLabel: 'Quay lại',
    variant: 'warning',
    triggerElement: event.currentTarget,
    onConfirm: () => resource.runMutation(
      () => deactivateArea(area.id),
      'Đã ngừng sử dụng khu vực.',
      'Không thể ngừng sử dụng khu vực.',
      { removeCurrentItem: resource.query.isActive === true, throwOnError: true },
    ),
  });
  const columns: Column<Area>[] = [
    { header: 'Mã', accessor: 'code', sortKey: 'code' }, { header: 'Tên khu vực', accessor: 'name', sortKey: 'name' },
    { header: 'Mô tả', accessor: 'description', sortKey: 'description', render: (area) => area.description || '—' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (area) => <StatusBadge active={area.is_active} /> },
    ...(hasActions ? [{ header: 'Thao tác', accessor: 'actions', render: (area: Area) => <RowActions onView={() => openView(area)} onEdit={canUpdate ? () => { setEditing(area); setViewing(false); setFormError(null); setFormOpen(true); } : undefined} onDelete={canDelete ? (event) => confirmDeactivate(area, event) : undefined} deleteLabel="Ngừng sử dụng" /> }] : []),
  ];
  return (
    <div className="space-y-6">
      <CrudPageHeader title="Areas" description="Quản lý khu vực và mã khu vực duy nhất." createLabel="Thêm khu vực" onCreate={canCreate ? () => { setEditing(null); setViewing(false); setFormError(null); setFormOpen(true); } : undefined} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id} searchPlaceholder="Tìm mã hoặc tên khu vực..." searchValue={search} onSearchChange={setSearch} renderTopToolbar={() => <select value={String(resource.query.isActive ?? true)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })} className={inputClassName}><option value="true">Active</option><option value="false">Inactive</option></select>} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có khu vực phù hợp." />}
      {formOpen && (viewing || (editing ? canUpdate : canCreate)) && <PrimaryCrudDrawer mode={viewing ? 'view' : editing ? 'edit' : 'create'} size="md" onEdit={viewing && canUpdate ? () => setViewing(false) : undefined} error={formError} title={viewing ? 'Chi tiết khu vực' : (editing ? 'Chỉnh sửa khu vực' : 'Tạo khu vực')} busy={resource.mutating} onClose={() => setFormOpen(false)}>{viewing && editing ? <CrudEntityView fields={[
            { label: 'Mã', value: editing.code },
            { label: 'Tên', value: editing.name },
            { label: 'Mô tả', value: editing.description, fullWidth: true },
            { label: 'Trạng thái', value: <StatusBadge active={editing.is_active && !editing.is_deleted} /> },
            { label: 'Ngày tạo', value: new Date(editing.created_at).toLocaleString('vi-VN') },
            { label: 'Cập nhật', value: new Date(editing.updated_at).toLocaleString('vi-VN') },
          ]} /> : (<AreaForm key={editing?.id ?? 'create'} area={editing} busy={resource.mutating} onSave={save} />)}</PrimaryCrudDrawer>}
    </div>
  );
};
export default AreasPage;
