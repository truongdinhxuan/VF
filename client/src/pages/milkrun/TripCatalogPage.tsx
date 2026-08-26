import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { DataTable, type Column } from '../../components/common/DataTable';
import {
  ConfirmDialog,
  CrudFeedbackToast,
  CrudModal,
  CrudPageHeader,
  ErrorState,
  FieldError,
  FormActions,
  RowActions,
  StatusBadge,
  inputClassName,
  labelClassName,
} from '../../components/crud/CrudPrimitives';
import { PERMISSION_CODE, type PermissionCode } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type {
  MilkrunLookupListParams,
  MilkrunTripStatusInput,
  MilkrunTripStatusRecord,
  MilkrunTripType,
  MilkrunTripTypeInput,
} from '../../types/milkrun';
import type { PaginatedResponse, PaginationParams } from '../../types/pagination.types';

type ResourceName = 'trip-types' | 'trip-statuses';
type CatalogItem = MilkrunTripType | MilkrunTripStatusRecord;
type CatalogQuery = MilkrunLookupListParams & PaginationParams;

interface CatalogFormValues extends MilkrunTripTypeInput {
  sort_order?: number;
}

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

const CatalogForm = ({
  resourceName,
  item,
  busy,
  onCancel,
  onSave,
}: {
  resourceName: ResourceName;
  item: CatalogItem | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: CatalogFormValues) => Promise<void>;
}) => {
  const isStatus = resourceName === 'trip-statuses';
  const statusItem = item && 'sort_order' in item ? item : null;
  const { register, handleSubmit, formState: { errors } } = useForm<CatalogFormValues>({
    defaultValues: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      is_active: item?.is_active ?? true,
      sort_order: statusItem?.sort_order ?? 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <label className={labelClassName}>
        Code *
        <input
          {...register('code', {
            required: 'Vui lòng nhập code.',
            maxLength: { value: 100, message: 'Code tối đa 100 ký tự.' },
            pattern: {
              value: /^[A-Za-z][A-Za-z0-9_]*$/,
              message: 'Code phải bắt đầu bằng chữ và chỉ gồm chữ, số hoặc dấu gạch dưới.',
            },
          })}
          className={`${inputClassName} ${item?.is_system ? 'bg-slate-100' : ''}`}
          readOnly={item?.is_system}
          aria-readonly={item?.is_system}
          autoFocus={!item?.is_system}
        />
        <FieldError message={errors.code?.message} />
        {item?.is_system && (
          <span className="text-xs font-normal text-slate-500">Code hệ thống không thể thay đổi.</span>
        )}
      </label>

      <label className={labelClassName}>
        Tên *
        <input
          {...register('name', {
            required: 'Vui lòng nhập tên.',
            maxLength: { value: 255, message: 'Tên tối đa 255 ký tự.' },
          })}
          className={inputClassName}
        />
        <FieldError message={errors.name?.message} />
      </label>

      <label className={labelClassName}>
        Mô tả
        <textarea
          {...register('description', {
            maxLength: { value: 2000, message: 'Mô tả tối đa 2000 ký tự.' },
          })}
          className={`${inputClassName} min-h-28 resize-y`}
        />
        <FieldError message={errors.description?.message} />
      </label>

      {isStatus && (
        <label className={labelClassName}>
          Thứ tự *
          <input
            type="number"
            min={0}
            step={1}
            {...register('sort_order', {
              required: 'Vui lòng nhập thứ tự.',
              valueAsNumber: true,
              min: { value: 0, message: 'Thứ tự không được âm.' },
            })}
            className={inputClassName}
          />
          <FieldError message={errors.sort_order?.message} />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          {...register('is_active')}
          disabled={item?.is_system}
        />
        Đang hoạt động
      </label>

      <FormActions
        busy={busy}
        onCancel={onCancel}
        submitLabel={item ? 'Lưu thay đổi' : `Tạo ${definitions[resourceName].singular}`}
      />
    </form>
  );
};

const TripCatalogPage = ({ resourceName }: { resourceName: ResourceName }) => {
  const definition = definitions[resourceName];
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(definition.createPermission);
  const canUpdate = hasPermission(definition.updatePermission);
  const canDeactivate = hasPermission(definition.deactivatePermission);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<CatalogItem | null>(null);

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
    );
    if (ok) setFormOpen(false);
  };

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
    if (canUpdate || canDeactivate) {
      result.push({
        header: 'Thao tác',
        accessor: 'actions',
        render: (item) => (
          <RowActions
            onEdit={canUpdate ? () => {
              setEditing(item);
              setFormOpen(true);
            } : undefined}
            onDelete={canDeactivate && item.is_active && !item.is_system
              ? () => setDeactivateTarget(item)
              : undefined}
            deleteLabel="Deactivate"
          />
        ),
      });
    }
    return result;
  }, [canDeactivate, canUpdate, resourceName]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title={definition.title}
        description={definition.description}
        createLabel={`Thêm ${definition.singular}`}
        onCreate={canCreate ? () => {
          setEditing(null);
          setFormOpen(true);
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

      {formOpen && (editing ? canUpdate : canCreate) && (
        <CrudModal
          title={editing ? `Chỉnh sửa ${definition.singular}` : `Tạo ${definition.singular}`}
          busy={resource.mutating}
          onClose={() => setFormOpen(false)}
        >
          <CatalogForm
            resourceName={resourceName}
            item={editing}
            busy={resource.mutating}
            onCancel={() => setFormOpen(false)}
            onSave={save}
          />
        </CrudModal>
      )}

      {deactivateTarget && canDeactivate && !deactivateTarget.is_system && (
        <ConfirmDialog
          title={`Deactivate ${definition.singular}?`}
          message={`“${deactivateTarget.code}” sẽ không còn xuất hiện trong dropdown active. Dữ liệu lịch sử vẫn được giữ nguyên.`}
          confirmLabel="Deactivate"
          busy={resource.mutating}
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() => void resource.runMutation(
            () => resourceName === 'trip-types'
              ? deactivateMilkrunTripType(deactivateTarget.id)
              : deactivateMilkrunTripStatus(deactivateTarget.id),
            `Đã deactivate ${definition.singular}.`,
            `Không thể deactivate ${definition.singular}.`,
            { removeCurrentItem: resource.query.isActive === true },
          ).then((ok) => {
            if (ok) setDeactivateTarget(null);
          })}
        />
      )}
    </section>
  );
};

export default TripCatalogPage;
