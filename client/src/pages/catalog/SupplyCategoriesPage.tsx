import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createSupplyCategory,
  deactivateSupplyCategory,
  listSupplyCategories,
  updateSupplyCategory,
} from '../../api/supply-categories.service';
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
import type {
  CreateSupplyCategoryInput,
  SupplyCategory,
  SupplyCategoryListParams,
} from '../../types/supply-categories';

type CategoryQuery = SupplyCategoryListParams & PaginationParams;
const initialQuery: CategoryQuery = {
  page: 1,
  pageSize: 20,
  isActive: true,
  sortBy: 'code',
  sortOrder: 'asc',
};

const CategoryForm = ({ item, busy, onCancel, onSave }: {
  item: SupplyCategory | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: CreateSupplyCategoryInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateSupplyCategoryInput>({
    defaultValues: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      is_active: item?.is_active ?? true,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <label className={labelClassName}>
        <span>Mã danh mục</span>
        <input {...register('code', { required: 'Vui lòng nhập mã danh mục.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
        <FieldError message={errors.code?.message} />
      </label>
      <label className={labelClassName}>
        <span>Tên danh mục</span>
        <input
          {...register('name', {
            required: 'Vui lòng nhập tên danh mục.',
            setValueAs: (value: string) => value.trim(),
          })}
          className={inputClassName}
        />
        <FieldError message={errors.name?.message} />
      </label>
      <label className={labelClassName}>
        <span>Mô tả</span>
        <textarea rows={3} {...register('description', { setValueAs: (value: string) => value.trim() || null })} className={inputClassName} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" />
        Đang hoạt động
      </label>
      <FormActions busy={busy} onCancel={onCancel} submitLabel={item ? 'Lưu thay đổi' : 'Tạo danh mục'} />
    </form>
  );
};

const SupplyCategoriesPage = () => {
  const { role } = useAuth();
  const canMutate = role !== null && MASTER_DATA_MANAGER_ROLES.includes(role);
  const loader = useCallback((query: CategoryQuery, signal: AbortSignal) => listSupplyCategories(query, signal), []);
  const resource = usePaginatedResource<SupplyCategory, CategoryQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh mục vật tư.',
    queryKey: queryKeys.supplyCategories.lists,
    invalidateQueryKeys: [queryKeys.supplies.all],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const [editing, setEditing] = useState<SupplyCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplyCategory | null>(null);

  useEffect(() => {
    const nextSearch = debouncedSearch.trim() || undefined;
    if (resourceSearch !== nextSearch) updateResourceQuery({ search: nextSearch });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: CreateSupplyCategoryInput) => {
    const ok = await resource.runMutation(
      () => editing ? updateSupplyCategory(editing.id, values) : createSupplyCategory(values),
      editing ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục.',
      editing ? 'Không thể cập nhật danh mục.' : 'Không thể tạo danh mục.',
    );
    if (ok) setFormOpen(false);
  };

  const columns: Column<SupplyCategory>[] = [
    { header: 'Mã', accessor: 'code', sortKey: 'code' },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    { header: 'Mô tả', accessor: 'description', sortKey: 'description', render: (item) => item.description || '—' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active} /> },
    ...(canMutate ? [{
      header: 'Thao tác',
      accessor: 'actions',
      render: (item: SupplyCategory) => <RowActions onEdit={() => { setEditing(item); setFormOpen(true); }} onDelete={() => setDeleteTarget(item)} />,
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader
        title="Supply categories"
        description="Quản lý nhóm vật tư với mã danh mục duy nhất."
        createLabel="Thêm danh mục"
        onCreate={canMutate ? () => { setEditing(null); setFormOpen(true); } : undefined}
      />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(item) => item.id}
          searchPlaceholder="Tìm mã hoặc mô tả danh mục..."
          searchValue={search}
          onSearchChange={setSearch}
          renderTopToolbar={() => <select value={String(resource.query.isActive ?? true)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })} className={inputClassName}><option value="true">Active</option><option value="false">Inactive</option></select>}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Không có danh mục phù hợp."
        />
      )}
      {formOpen && canMutate && <CrudModal title={editing ? 'Chỉnh sửa danh mục' : 'Tạo danh mục'} busy={resource.mutating} onClose={() => setFormOpen(false)}><CategoryForm key={editing?.id ?? 'create'} item={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} /></CrudModal>}
      {deleteTarget && canMutate && <ConfirmDialog title="Ngừng hoạt động danh mục?" message={`Danh mục “${deleteTarget.code}” sẽ được soft delete nếu không vi phạm ràng buộc dữ liệu.`} confirmLabel="Deactivate" busy={resource.mutating} onCancel={() => setDeleteTarget(null)} onConfirm={() => void resource.runMutation(() => deactivateSupplyCategory(deleteTarget.id), 'Đã deactivate danh mục.', 'Không thể deactivate danh mục.', { removeCurrentItem: resource.query.isActive === true }).then((ok) => { if (ok) setDeleteTarget(null); })} />}
    </div>
  );
};

export default SupplyCategoriesPage;
