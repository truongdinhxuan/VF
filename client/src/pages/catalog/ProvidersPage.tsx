import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createProvider,
  deactivateProvider,
  getProviders,
  updateProvider,
} from '../../api/providers.service';
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
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { PaginationParams } from '../../types/pagination.types';
import type {
  CreateProviderInput,
  Provider,
  ProviderListParams,
} from '../../types/providers';

const UNKNOWN_PROVIDER_CODE = 'UNKNOW';

type ProviderQuery = ProviderListParams & PaginationParams;
type StatusFilter = 'active' | 'inactive' | 'deleted';

const initialQuery: ProviderQuery = {
  page: 1,
  pageSize: 20,
  isActive: true,
  isDeleted: false,
  sortBy: 'code',
  sortOrder: 'asc',
};

const resolveStatusFilter = (query: ProviderQuery): StatusFilter => {
  if (query.isDeleted) return 'deleted';
  return query.isActive === false ? 'inactive' : 'active';
};

const statusQuery = (
  status: StatusFilter,
): Pick<ProviderQuery, 'isActive' | 'isDeleted'> => {
  if (status === 'deleted') return { isActive: false, isDeleted: true };
  if (status === 'inactive') return { isActive: false, isDeleted: false };
  return { isActive: true, isDeleted: false };
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
};

const ProviderForm = ({
  item,
  busy,
  onCancel,
  onSave,
}: {
  item: Provider | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: CreateProviderInput) => Promise<void>;
}) => {
  const isUnknown = item?.code === UNKNOWN_PROVIDER_CODE;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProviderInput>({
    defaultValues: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      is_active: item?.is_active ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      {isUnknown && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          UNKNOW — Chưa rõ là Provider hệ thống. Không thể đổi code hoặc deactivate.
        </div>
      )}
      <label className={labelClassName}>
        <span>Code</span>
        <input
          {...register('code', {
            required: 'Vui lòng nhập Provider code.',
            setValueAs: (value: string) => value.trim(),
          })}
          readOnly={isUnknown}
          aria-readonly={isUnknown}
          className={`${inputClassName} ${isUnknown ? 'cursor-not-allowed bg-slate-100' : ''}`}
        />
        <FieldError message={errors.code?.message} />
      </label>
      <label className={labelClassName}>
        <span>Tên Provider</span>
        <input
          {...register('name', {
            required: 'Vui lòng nhập tên Provider.',
            setValueAs: (value: string) => value.trim(),
          })}
          className={inputClassName}
        />
        <FieldError message={errors.name?.message} />
      </label>
      <label className={labelClassName}>
        <span>Mô tả</span>
        <textarea
          rows={4}
          {...register('description', {
            setValueAs: (value: string) => value.trim() || null,
          })}
          className={inputClassName}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          {...register('is_active')}
          disabled={isUnknown}
          className="h-4 w-4 rounded border-slate-300"
        />
        Đang hoạt động
      </label>
      <FormActions
        busy={busy}
        onCancel={onCancel}
        submitLabel={item ? 'Lưu thay đổi' : 'Tạo Provider'}
      />
    </form>
  );
};

const ProvidersPage = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE);
  const canUpdate = hasPermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE);
  const canDelete = hasPermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE);
  const hasActions = canUpdate || canDelete;
  const loader = useCallback(
    (query: ProviderQuery, signal: AbortSignal) => getProviders(query, signal),
    [],
  );
  const resource = usePaginatedResource<Provider, ProviderQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh sách Provider.',
    queryKey: queryKeys.providers.lists,
    invalidateQueryKeys: [
      queryKeys.providers.lookups,
      queryKeys.supplyProviders.all,
      queryKeys.supplies.all,
    ],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Provider | null>(null);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const nextSearch = debouncedSearch.trim() || undefined;
    if (nextSearch !== resourceSearch) {
      updateResourceQuery({ search: nextSearch });
    }
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: CreateProviderInput) => {
    const input = {
      ...values,
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description?.trim() || null,
    };
    const ok = await resource.runMutation(
      () => editing
        ? updateProvider(editing.id, input)
        : createProvider(input),
      editing ? 'Đã cập nhật Provider.' : 'Đã tạo Provider.',
      editing ? 'Không thể cập nhật Provider.' : 'Không thể tạo Provider.',
    );
    if (ok) {
      setFormOpen(false);
      setEditing(null);
    }
  };

  const columns: Column<Provider>[] = [
    {
      header: 'Code',
      accessor: 'code',
      sortKey: 'code',
      render: (item) => item.code === UNKNOWN_PROVIDER_CODE
        ? <span className="font-bold text-amber-700">UNKNOW — Chưa rõ</span>
        : <span className="font-semibold text-slate-800">{item.code}</span>,
    },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    {
      header: 'Mô tả',
      accessor: 'description',
      render: (item) => item.description || '—',
    },
    {
      header: 'Trạng thái',
      accessor: 'is_active',
      sortKey: 'is_active',
      render: (item) => <StatusBadge active={item.is_active && !item.is_deleted} />,
    },
    {
      header: 'Cập nhật',
      accessor: 'updated_at',
      sortKey: 'updated_at',
      render: (item) => formatDate(item.updated_at),
    },
    ...(hasActions ? [{
      header: 'Thao tác',
      accessor: 'actions',
      render: (item: Provider) => (
        <RowActions
          onEdit={canUpdate ? () => {
            setEditing(item);
            setFormOpen(true);
          } : undefined}
          onDelete={!canDelete || item.code === UNKNOWN_PROVIDER_CODE
            ? undefined
            : () => setDeactivateTarget(item)}
        />
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader
        title="Providers"
        description="Quản lý nhà cung cấp được liên kết với vật tư và tồn kho."
        createLabel="Thêm Provider"
        onCreate={canCreate ? () => {
          setEditing(null);
          setFormOpen(true);
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
          loadingText="Đang tải danh sách Provider..."
          keyExtractor={(item) => item.id}
          searchPlaceholder="Tìm code, tên hoặc mô tả Provider..."
          searchValue={search}
          onSearchChange={setSearch}
          renderTopToolbar={() => (
            <select
              value={resolveStatusFilter(resource.query)}
              onChange={(event) => resource.updateQuery(
                statusQuery(event.target.value as StatusFilter),
              )}
              className={inputClassName}
              aria-label="Lọc trạng thái Provider"
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
              <option value="deleted">Đã deactivate</option>
            </select>
          )}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) =>
            resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Không có Provider phù hợp."
        />
      )}

      {formOpen && (editing ? canUpdate : canCreate) && (
        <CrudModal
          title={editing ? 'Chỉnh sửa Provider' : 'Tạo Provider'}
          busy={resource.mutating}
          onClose={() => setFormOpen(false)}
        >
          <ProviderForm
            key={editing?.id ?? 'create'}
            item={editing}
            busy={resource.mutating}
            onCancel={() => setFormOpen(false)}
            onSave={save}
          />
        </CrudModal>
      )}

      {deactivateTarget && canDelete && (
        <ConfirmDialog
          title="Deactivate Provider?"
          message={`Provider “${deactivateTarget.code} — ${deactivateTarget.name}” sẽ ngừng hoạt động và bị soft delete.`}
          confirmLabel="Deactivate"
          busy={resource.mutating}
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() => void resource.runMutation(
            () => deactivateProvider(deactivateTarget.id),
            'Đã deactivate Provider.',
            'Không thể deactivate Provider.',
            { removeCurrentItem: resolveStatusFilter(resource.query) === 'active' },
          ).then((ok) => {
            if (ok) setDeactivateTarget(null);
          })}
        />
      )}
    </div>
  );
};

export default ProvidersPage;
