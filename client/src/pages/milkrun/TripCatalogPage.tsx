import { useCallback,useEffect,useMemo,useState,type MouseEvent } from 'react';
import {
createMilkrunTripStatus,
createMilkrunTripType,
deactivateMilkrunTripStatus,
deactivateMilkrunTripType,
listMilkrunTripStatuses,
listMilkrunTripTypes,
updateMilkrunTripStatus,
updateMilkrunTripType,
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
import { CatalogForm,type CatalogFormValues,type CatalogItem,type ResourceName } from '../../components/forms/CatalogForm';
import { PERMISSION_CODE,type PermissionCode } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type {
MilkrunLookupListParams,
MilkrunTripStatusInput,
MilkrunTripTypeInput
} from '../../types/milkrun';
import type { PaginatedResponse,PaginationParams } from '../../types/pagination.types';

type CatalogQuery = MilkrunLookupListParams & PaginationParams;

interface CatalogDefinition {
  title: string;
  singular: string;
  description: string;
  defaultSortBy: string;
  readPermission: PermissionCode;
  createPermission: PermissionCode;
  updatePermission: PermissionCode;
  deactivatePermission: PermissionCode;
}

const definitions: Record<ResourceName, CatalogDefinition> = {
  'trip-types': {
    title: 'Loại chuyến',
    singular: 'loại chuyến',
    description: 'Danh mục loại chuyến Milkrun. Các code hệ thống được bảo vệ ở backend.',
    defaultSortBy: 'code',
    readPermission: PERMISSION_CODE.MILKRUN_TRIP_TYPE_READ,
    createPermission: PERMISSION_CODE.MILKRUN_TRIP_TYPE_CREATE,
    updatePermission: PERMISSION_CODE.MILKRUN_TRIP_TYPE_UPDATE,
    deactivatePermission: PERMISSION_CODE.MILKRUN_TRIP_TYPE_DEACTIVATE,
  },
  'trip-statuses': {
    title: 'Trạng thái chuyến',
    singular: 'trạng thái chuyến',
    description: 'Danh mục trạng thái bám theo StatusFlow. Code hệ thống không được đổi hoặc deactivate.',
    defaultSortBy: 'sort_order',
    readPermission: PERMISSION_CODE.MILKRUN_TRIP_STATUS_READ,
    createPermission: PERMISSION_CODE.MILKRUN_TRIP_STATUS_CREATE,
    updatePermission: PERMISSION_CODE.MILKRUN_TRIP_STATUS_UPDATE,
    deactivatePermission: PERMISSION_CODE.MILKRUN_TRIP_STATUS_DEACTIVATE,
  },
};

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const TripCatalogPage = ({ resourceName }: { resourceName: ResourceName }) => {
  const { openConfirm } = useCrudOffcanvas();
  const definition = definitions[resourceName];
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(definition.createPermission);
  const canUpdate = hasPermission(definition.updatePermission);
  const canDeactivate = hasPermission(definition.deactivatePermission);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const openView = useCallback((item: CatalogItem) => {
    setEditing(item); setViewing(true); setFormError(null); setFormOpen(true);
  }, []);

  const loader = useCallback(
    (query: CatalogQuery, signal: AbortSignal): Promise<PaginatedResponse<CatalogItem>> => (
      resourceName === 'trip-types'
        ? listMilkrunTripTypes(query, signal)
        : listMilkrunTripStatuses(query, signal)
    ),
    [resourceName],
  );

  const resource = usePaginatedResource<CatalogItem, CatalogQuery>({
    loader,
    initialQuery: {
      page: 1,
      pageSize: 20,
      sortBy: definition.defaultSortBy,
      sortOrder: 'asc',
      isActive: true,
      isDeleted: false,
    },
    loadErrorMessage: `Không thể tải danh sách ${definition.title}.`,
    queryKey: resourceName === 'trip-types'
      ? queryKeys.milkrunTripTypes.lists
      : queryKeys.milkrunTripStatuses.lists,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const save = async (values: CatalogFormValues) => {
    setFormError(null);
    try {
      const baseInput: MilkrunTripTypeInput = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        description: values.description?.trim() || null,
        is_active: editing?.is_system ? true : values.is_active,
      };

      const operation = resourceName === 'trip-types'
        ? () => editing
          ? updateMilkrunTripType(editing.id, baseInput)
          : createMilkrunTripType(baseInput)
        : () => {
          const statusInput: MilkrunTripStatusInput = {
            ...baseInput,
            sort_order: Number(values.sort_order),
          };
          return editing
            ? updateMilkrunTripStatus(editing.id, statusInput)
            : createMilkrunTripStatus(statusInput);
        };

      const ok = await resource.runMutation(
        operation,
        editing ? `Đã cập nhật ${definition.singular}.` : `Đã tạo ${definition.singular}.`,
        editing ? `Không thể cập nhật ${definition.singular}.` : `Không thể tạo ${definition.singular}.`,
        { throwOnError: true },
      );
      if (ok) setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại.');
    }
  };

  const confirmDeactivate = useCallback((
    item: CatalogItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => openConfirm({
    title: `Ngừng sử dụng ${definition.singular}?`,
    description: `“${item.code}” sẽ không còn xuất hiện trong dropdown active. Dữ liệu lịch sử vẫn được giữ nguyên.`,
    confirmLabel: 'Ngừng sử dụng',
    cancelLabel: 'Quay lại',
    variant: 'warning',
    triggerElement: event.currentTarget,
    onConfirm: () => resource.runMutation(
      () => resourceName === 'trip-types'
        ? deactivateMilkrunTripType(item.id)
        : deactivateMilkrunTripStatus(item.id),
      `Đã ngừng sử dụng ${definition.singular}.`,
      `Không thể ngừng sử dụng ${definition.singular}.`,
      { removeCurrentItem: resource.query.isActive === true, throwOnError: true },
    ),
  }), [definition.singular, openConfirm, resource, resourceName]);

  const columns = useMemo<Column<CatalogItem>[]>(() => {
    const result: Column<CatalogItem>[] = [
      { header: 'Code', accessor: 'code', sortKey: 'code' },
      { header: 'Tên', accessor: 'name', sortKey: 'name' },
      { header: 'Mô tả', accessor: 'description', render: (item) => item.description || '—' },
    ];
    if (resourceName === 'trip-statuses') {
      result.push({
        header: 'Thứ tự',
        accessor: 'sort_order',
        sortKey: 'sort_order',
        render: (item) => 'sort_order' in item ? item.sort_order : '—',
      });
    }
    result.push(
      { header: 'Loại', accessor: 'is_system', render: (item) => item.is_system ? 'System' : 'Custom' },
      { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active} /> },
      { header: 'Cập nhật', accessor: 'updated_at', sortKey: 'updated_at', render: (item) => formatDate(item.updated_at) },
    );
    { // The page read guard also permits read-only detail.
      result.push({
        header: 'Thao tác',
        accessor: 'actions',
        render: (item) => (
          <RowActions
            onView={() => openView(item)} onEdit={canUpdate ? () => {
              setEditing(item);
              setViewing(false); setFormError(null); setFormOpen(true);
            } : undefined}
            onDelete={canDeactivate && item.is_active && !item.is_system
              ? (event) => confirmDeactivate(item, event)
              : undefined}
            deleteLabel="Ngừng sử dụng"
          />
        ),
      });
    }
    return result;
  }, [canDeactivate, canUpdate, confirmDeactivate, openView, resourceName]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title={definition.title}
        description={definition.description}
        createLabel={`Thêm ${definition.singular}`}
        onCreate={canCreate ? () => {
          setEditing(null);
          setViewing(false); setFormError(null); setFormOpen(true);
        } : undefined}
      />

      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />

      {resource.error ? (
        <ErrorState message={resource.error} onRetry={() => void resource.reload()} />
      ) : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(item) => item.id}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder={`Tìm code, tên hoặc mô tả ${definition.singular}...`}
          renderTopToolbar={() => (
            <select
              value={String(resource.query.isActive ?? true)}
              onChange={(event) => resource.updateQuery({
                isActive: event.target.value === 'true',
              })}
              className={inputClassName}
              aria-label={`Lọc trạng thái ${definition.singular}`}
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
          emptyText={`Không có ${definition.title} phù hợp.`}
        />
      )}

      {formOpen && (viewing || (editing ? canUpdate : canCreate)) && (
        <PrimaryCrudDrawer mode={viewing ? 'view' : editing ? 'edit' : 'create'} size="md" onEdit={viewing && canUpdate ? () => setViewing(false) : undefined} error={formError}
          title={viewing ? `Chi tiết ${definition.singular}` : editing ? `Chỉnh sửa ${definition.singular}` : `Tạo ${definition.singular}`}
          busy={resource.mutating}
          onClose={() => setFormOpen(false)}
        >
          {viewing && editing ? <CrudEntityView fields={[
            { label: 'Mã', value: editing.code },
            { label: 'Tên', value: editing.name },
            { label: 'Mô tả', value: editing.description, fullWidth: true },
            { label: 'Loại', value: editing.is_system ? 'Hệ thống' : 'Tùy chỉnh' },
            ...('sort_order' in editing ? [{ label: 'Thứ tự', value: editing.sort_order }] : []),
            { label: 'Trạng thái', value: <StatusBadge active={editing.is_active && !editing.is_deleted} /> },
            { label: 'Ngày tạo', value: new Date(editing.created_at).toLocaleString('vi-VN') },
            { label: 'Cập nhật', value: new Date(editing.updated_at).toLocaleString('vi-VN') },
          ]} /> : (<CatalogForm
            resourceName={resourceName}
            item={editing}
            busy={resource.mutating}
            onSave={save}
          />)}
        </PrimaryCrudDrawer>
      )}

    </section>
  );
};

export default TripCatalogPage;
