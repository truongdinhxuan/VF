import { useCallback,useEffect,useMemo,useState,type MouseEvent } from 'react';
import {
createMilkrunRack,
deactivateMilkrunRack,
listMilkrunRacks,
updateMilkrunRack,
} from '../../api/milkrun-master-data.service';
import { DataTable,type Column } from '../../components/common/DataTable';
import { CrudEntityView } from '../../components/crud/CrudEntityView';
import {
CrudFeedbackToast,
CrudPageHeader,
ErrorState,
RowActions,
StatusBadge,
inputClassName
} from '../../components/crud/CrudPrimitives';
import { PrimaryCrudDrawer } from '../../components/crud/PrimaryCrudDrawer';
import { RackForm } from '../../components/forms/RackForm';
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunLookupListParams,MilkrunRack,MilkrunRackInput } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type RackQuery = MilkrunLookupListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const RacksPage = () => {
  const { openConfirm } = useCrudOffcanvas();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSION_CODE.MILKRUN_RACK_CREATE);
  const canUpdate = hasPermission(PERMISSION_CODE.MILKRUN_RACK_UPDATE);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [editing, setEditing] = useState<MilkrunRack | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const openView = useCallback((item: MilkrunRack) => {
    setEditing(item); setViewing(true); setFormError(null); setFormOpen(true);
  }, []);
  const loader = useCallback(
    (query: RackQuery, signal: AbortSignal) => listMilkrunRacks(query, signal),
    [],
  );
  const resource = usePaginatedResource<MilkrunRack, RackQuery>({
    loader,
    initialQuery: {
      page: 1,
      pageSize: 20,
      sortBy: 'code',
      sortOrder: 'asc',
      isActive: true,
      isDeleted: false,
    },
    loadErrorMessage: 'Không thể tải danh sách Rack.',
    queryKey: queryKeys.milkrunRacks.lists,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const save = async (values: MilkrunRackInput) => {
    setFormError(null);
    try {
      const input: MilkrunRackInput = {
        ...values,
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        image_url: values.image_url?.trim() || null,
      };
      const ok = await resource.runMutation(
        () => editing ? updateMilkrunRack(editing.id, input) : createMilkrunRack(input),
        editing ? 'Đã cập nhật Rack.' : 'Đã tạo Rack.',
        editing ? 'Không thể cập nhật Rack.' : 'Không thể tạo Rack.',
        { throwOnError: true },
      );
      if (ok) setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại.');
    }
  };

  const confirmDeactivate = useCallback((
    rack: MilkrunRack,
    event: MouseEvent<HTMLButtonElement>,
  ) => openConfirm({
    title: 'Ngừng sử dụng Rack?',
    description: `Rack “${rack.code}” sẽ không còn xuất hiện trong dropdown active.`,
    confirmLabel: 'Ngừng sử dụng',
    cancelLabel: 'Quay lại',
    variant: 'warning',
    triggerElement: event.currentTarget,
    onConfirm: () => resource.runMutation(
      () => deactivateMilkrunRack(rack.id),
      'Đã ngừng sử dụng Rack.',
      'Không thể ngừng sử dụng Rack.',
      { removeCurrentItem: resource.query.isActive === true, throwOnError: true },
    ),
  }), [openConfirm, resource]);

  const columns = useMemo<Column<MilkrunRack>[]>(() => [
    { header: 'Code', accessor: 'code', sortKey: 'code' },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    {
      header: 'Ảnh',
      accessor: 'image_url',
      render: (rack) => rack.image_url
        ? <img src={rack.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
        : <span className="text-slate-400">—</span>,
    },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (rack) => <StatusBadge active={rack.is_active} /> },
    { header: 'Ngày tạo', accessor: 'created_at', sortKey: 'created_at', render: (rack) => formatDate(rack.created_at) },
    { header: 'Cập nhật', accessor: 'updated_at', sortKey: 'updated_at', render: (rack) => formatDate(rack.updated_at) },
    ...[{
      header: 'Thao tác',
      accessor: 'actions',
      render: (rack: MilkrunRack) => (
        <RowActions
          onView={() => openView(rack)} onEdit={canUpdate ? () => { setEditing(rack); setViewing(false); setFormError(null); setFormOpen(true); } : undefined}
          onDelete={canUpdate && rack.is_active ? (event) => confirmDeactivate(rack, event) : undefined}
          deleteLabel="Ngừng sử dụng"
        />
      ),
    }],
  ], [canUpdate, confirmDeactivate, openView]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title="Rack"
        description="Danh mục Rack dùng riêng cho nghiệp vụ Milkrun."
        createLabel="Thêm rack"
        onCreate={canCreate ? () => { setEditing(null); setViewing(false); setFormError(null); setFormOpen(true); } : undefined}
      />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(rack) => rack.id}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Tìm code hoặc tên Rack..."
          renderTopToolbar={() => (
            <select
              value={String(resource.query.isActive ?? true)}
              onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })}
              className={inputClassName}
              aria-label="Lọc trạng thái Rack"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          )}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Không có Rack phù hợp."
        />
      )}
      {formOpen && (viewing || (editing ? canUpdate : canCreate)) && (
        <PrimaryCrudDrawer mode={viewing ? 'view' : editing ? 'edit' : 'create'} size="md" onEdit={viewing && canUpdate ? () => setViewing(false) : undefined} error={formError} title={viewing ? 'Chi tiết rack' : (editing ? 'Chỉnh sửa Rack' : 'Tạo Rack')} busy={resource.mutating} onClose={() => setFormOpen(false)}>
          {viewing && editing ? <CrudEntityView fields={[
            { label: 'Mã', value: editing.code },
            { label: 'Tên', value: editing.name },
            { label: 'Ảnh', value: editing.image_url, fullWidth: true },
            { label: 'Trạng thái', value: <StatusBadge active={editing.is_active && !editing.is_deleted} /> },
            { label: 'Ngày tạo', value: new Date(editing.created_at).toLocaleString('vi-VN') },
            { label: 'Cập nhật', value: new Date(editing.updated_at).toLocaleString('vi-VN') },
          ]} /> : (<RackForm item={editing} busy={resource.mutating} onSave={save} />)}
        </PrimaryCrudDrawer>
      )}
    </section>
  );
};

export default RacksPage;
