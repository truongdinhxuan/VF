import { useCallback,useEffect,useMemo,useState,type MouseEvent } from 'react';
import {
createMilkrunShop,
deactivateMilkrunShop,
listMilkrunShops,
updateMilkrunShop,
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
import { ShopForm } from '../../components/forms/ShopForm';
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type {
MilkrunLookupListParams,
MilkrunShop,
MilkrunShopInput,
} from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type ShopQuery = MilkrunLookupListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const ShopsPage = () => {
  const { openConfirm } = useCrudOffcanvas();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSION_CODE.MILKRUN_SHOP_CREATE);
  const canUpdate = hasPermission(PERMISSION_CODE.MILKRUN_SHOP_UPDATE);
  const canDeactivate = hasPermission(PERMISSION_CODE.MILKRUN_SHOP_DEACTIVATE);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [editing, setEditing] = useState<MilkrunShop | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const openView = useCallback((item: MilkrunShop) => {
    setEditing(item); setViewing(true); setFormError(null); setFormOpen(true);
  }, []);
  const loader = useCallback(
    (query: ShopQuery, signal: AbortSignal) => listMilkrunShops(query, signal),
    [],
  );
  const resource = usePaginatedResource<MilkrunShop, ShopQuery>({
    loader,
    initialQuery: {
      page: 1,
      pageSize: 20,
      sortBy: 'code',
      sortOrder: 'asc',
      isActive: true,
      isDeleted: false,
    },
    loadErrorMessage: 'Không thể tải danh sách Shop.',
    queryKey: queryKeys.milkrunShops.lists,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const save = async (values: MilkrunShopInput) => {
    setFormError(null);
    try {
      const input: MilkrunShopInput = {
        ...values,
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        description: values.description?.trim() || null,
      };
      const ok = await resource.runMutation(
        () => editing
          ? updateMilkrunShop(editing.id, input)
          : createMilkrunShop(input),
        editing ? 'Đã cập nhật Shop.' : 'Đã tạo Shop.',
        editing ? 'Không thể cập nhật Shop.' : 'Không thể tạo Shop.',
        { throwOnError: true },
      );
      if (ok) setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại.');
    }
  };

  const confirmDeactivate = useCallback((
    shop: MilkrunShop,
    event: MouseEvent<HTMLButtonElement>,
  ) => openConfirm({
    title: 'Ngừng sử dụng Shop?',
    description: `Shop “${shop.code}” sẽ không còn xuất hiện trong dropdown active. Các Trip cũ vẫn giữ liên kết tới Shop này.`,
    confirmLabel: 'Ngừng sử dụng',
    cancelLabel: 'Quay lại',
    variant: 'warning',
    triggerElement: event.currentTarget,
    onConfirm: () => resource.runMutation(
      () => deactivateMilkrunShop(shop.id),
      'Đã ngừng sử dụng Shop.',
      'Không thể ngừng sử dụng Shop.',
      { removeCurrentItem: resource.query.isActive === true, throwOnError: true },
    ),
  }), [openConfirm, resource]);

  const columns = useMemo<Column<MilkrunShop>[]>(() => [
    { header: 'Code', accessor: 'code', sortKey: 'code' },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    {
      header: 'Mô tả',
      accessor: 'description',
      render: (shop) => shop.description || '—',
    },
    {
      header: 'Trạng thái',
      accessor: 'is_active',
      sortKey: 'is_active',
      render: (shop) => <StatusBadge active={shop.is_active} />,
    },
    {
      header: 'Ngày tạo',
      accessor: 'created_at',
      sortKey: 'created_at',
      render: (shop) => formatDate(shop.created_at),
    },
    {
      header: 'Cập nhật',
      accessor: 'updated_at',
      sortKey: 'updated_at',
      render: (shop) => formatDate(shop.updated_at),
    },
    ...[{
      header: 'Thao tác',
      accessor: 'actions',
      render: (shop: MilkrunShop) => (
        <RowActions
          onView={() => openView(shop)} onEdit={canUpdate ? () => {
            setEditing(shop);
            setViewing(false); setFormError(null); setFormOpen(true);
          } : undefined}
          onDelete={canDeactivate && shop.is_active
            ? (event) => confirmDeactivate(shop, event)
            : undefined}
          deleteLabel="Ngừng sử dụng"
        />
      ),
    }],
  ], [canDeactivate, canUpdate, confirmDeactivate, openView]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title="Shop"
        description="Danh mục Shop dùng riêng cho chuyến Milkrun; Shop không thay thế Area EDC Logistics."
        createLabel="Thêm Shop"
        onCreate={canCreate ? () => {
          setEditing(null);
          setViewing(false); setFormError(null); setFormOpen(true);
        } : undefined}
      />

      <CrudFeedbackToast
        feedback={resource.feedback}
        onClose={() => resource.setFeedback(null)}
      />

      {resource.error ? (
        <ErrorState message={resource.error} onRetry={() => void resource.reload()} />
      ) : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(shop) => shop.id}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Tìm code, tên hoặc mô tả Shop..."
          renderTopToolbar={() => (
            <select
              value={String(resource.query.isActive ?? true)}
              onChange={(event) => resource.updateQuery({
                isActive: event.target.value === 'true',
              })}
              className={inputClassName}
              aria-label="Lọc trạng thái Shop"
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
          emptyText="Không có Shop phù hợp."
        />
      )}

      {formOpen && (viewing || (editing ? canUpdate : canCreate)) && (
        <PrimaryCrudDrawer mode={viewing ? 'view' : editing ? 'edit' : 'create'} size="md" onEdit={viewing && canUpdate ? () => setViewing(false) : undefined} error={formError}
          title={viewing ? 'Chi tiết Shop' : (editing ? 'Chỉnh sửa Shop' : 'Tạo Shop')}
          busy={resource.mutating}
          onClose={() => setFormOpen(false)}
        >
          {viewing && editing ? <CrudEntityView fields={[
            { label: 'Mã', value: editing.code },
            { label: 'Tên', value: editing.name },
            { label: 'Mô tả', value: editing.description, fullWidth: true },
            { label: 'Trạng thái', value: <StatusBadge active={editing.is_active && !editing.is_deleted} /> },
            { label: 'Ngày tạo', value: new Date(editing.created_at).toLocaleString('vi-VN') },
            { label: 'Cập nhật', value: new Date(editing.updated_at).toLocaleString('vi-VN') },
          ]} /> : (<ShopForm
            item={editing}
            busy={resource.mutating}
            onSave={save}
          />)}
        </PrimaryCrudDrawer>
      )}

    </section>
  );
};

export default ShopsPage;
