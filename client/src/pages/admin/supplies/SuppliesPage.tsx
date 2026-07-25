import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { listSupplyCategories } from '../../../api/supply-categories.service';
import { createSupply, deactivateSupply, listSupplies, updateSupply } from '../../../api/supplies.service';
import { listUnits } from '../../../api/units.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import { ConfirmDialog, CrudFeedbackToast, CrudModal, CrudPageHeader, ErrorState, FieldError, FormActions, inputClassName, labelClassName, RowActions, StatusBadge } from '../../../components/admin/crud/CrudPrimitives';
import { SelectSkeleton } from '../../../components/common/skeleton';
import { MASTER_DATA_MANAGER_ROLES } from '../../../constants/roles';
import { useAuth } from '../../../context/AuthContext';
import { useCrudResource } from '../../../hooks/useCrudResource';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import { queryKeys } from '../../../lib/queryKeys';
import type { SupplyCategory } from '../../../types/supply-categories';
import type { PaginationParams } from '../../../types/pagination.types';
import type { CreateSupplyInput, Supply, SupplyListParams } from '../../../types/supplies';
import type { Unit } from '../../../types/units';

type SupplyQuery = SupplyListParams & PaginationParams;

const loadCategories = async (signal: AbortSignal) =>
  (await listSupplyCategories(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;
const loadUnits = async (signal: AbortSignal) =>
  (await listUnits(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;
const optionalNumber = (value: string) => value === '' ? null : Number(value);

const SupplyForm = ({ item, busy, categories, categoriesLoading, categoriesError, units, unitsLoading, unitsError, onCancel, onSave }: {
  item: Supply | null;
  busy: boolean;
  categories: SupplyCategory[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  units: Unit[];
  unitsLoading: boolean;
  unitsError: string | null;
  onCancel: () => void;
  onSave: (values: CreateSupplyInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateSupplyInput>({
    defaultValues: {
      code: item?.code ?? '',
      category_id: item?.category_id ?? '',
      unit_id: item?.unit_id ?? '',
      description: item?.description ?? '',
      min_stock: item?.min_stock ?? null,
      max_stock: item?.max_stock ?? null,
      safety_stock: item?.safety_stock ?? null,
      image_url: item?.image_url ?? '',
      is_active: item?.is_active ?? true,
    },
  });
  const referencesUnavailable = categoriesLoading || unitsLoading || Boolean(categoriesError || unitsError) || categories.length === 0 || units.length === 0;

  return <form onSubmit={handleSubmit(onSave)} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClassName}><span>Mã vật tư</span><input {...register('code', { required: 'Vui lòng nhập mã vật tư.', setValueAs: (value: string) => value.trim() })} className={inputClassName} /><FieldError message={errors.code?.message} /></label>
      <label className={labelClassName}><span>Danh mục</span>
        {categoriesLoading && categories.length === 0 ? <SelectSkeleton label="Đang tải danh mục vật tư" /> : <select {...register('category_id', { required: 'Vui lòng chọn danh mục.' })} disabled={Boolean(categoriesError)} className={inputClassName}>
          <option value="">Chọn danh mục</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.code}{category.description ? ` - ${category.description}` : ''}</option>)}
        </select>}
        {categoriesError ? <FieldError message={`Không tải được danh mục: ${categoriesError}`} /> : categories.length === 0 && !categoriesLoading ? <FieldError message="Chưa có danh mục active để lựa chọn." /> : <FieldError message={errors.category_id?.message} />}
      </label>
      <label className={labelClassName}><span>Đơn vị tính</span>
        {unitsLoading && units.length === 0 ? <SelectSkeleton label="Đang tải đơn vị tính" /> : <select {...register('unit_id', { required: 'Vui lòng chọn đơn vị tính.' })} disabled={Boolean(unitsError)} className={inputClassName}>
          <option value="">Chọn đơn vị</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} - {unit.symbol}</option>)}
        </select>}
        {unitsError ? <FieldError message={`Không tải được đơn vị: ${unitsError}`} /> : units.length === 0 && !unitsLoading ? <FieldError message="Chưa có đơn vị active để lựa chọn." /> : <FieldError message={errors.unit_id?.message} />}
      </label>
    </div>
    <label className={labelClassName}><span>Mô tả vật tư</span><textarea rows={3} {...register('description', { setValueAs: (value: string) => value.trim() || null })} className={inputClassName} /></label>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className={labelClassName}><span>Min stock</span><input type="number" min="0" step="any" {...register('min_stock', { setValueAs: optionalNumber, min: { value: 0, message: 'Không được âm.' } })} className={inputClassName} /><FieldError message={errors.min_stock?.message} /></label>
      <label className={labelClassName}><span>Max stock</span><input type="number" min="0" step="any" {...register('max_stock', { setValueAs: optionalNumber, min: { value: 0, message: 'Không được âm.' } })} className={inputClassName} /><FieldError message={errors.max_stock?.message} /></label>
      <label className={labelClassName}><span>Safety stock</span><input type="number" min="0" step="any" {...register('safety_stock', { setValueAs: optionalNumber, min: { value: 0, message: 'Không được âm.' } })} className={inputClassName} /><FieldError message={errors.safety_stock?.message} /></label>
    </div>
    <label className={labelClassName}><span>Image URL</span><input type="url" {...register('image_url', { setValueAs: (value: string) => value.trim() || null })} className={inputClassName} /></label>
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" /> Đang hoạt động</label>
    <FormActions busy={busy || referencesUnavailable} onCancel={onCancel} submitLabel={item ? 'Lưu thay đổi' : 'Tạo vật tư'} />
  </form>;
};

const SuppliesPage = () => {
  const { role } = useAuth();
  const canMutate = role !== null && MASTER_DATA_MANAGER_ROLES.includes(role);
  const loader = useCallback((query: SupplyQuery, signal: AbortSignal) => listSupplies(query, signal), []);
  const resource = usePaginatedResource<Supply, SupplyQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, isActive: true, isDeleted: false, sortBy: 'code', sortOrder: 'asc' },
    loadErrorMessage: 'Không thể tải danh sách vật tư.',
    queryKey: queryKeys.supplies.lists,
    invalidateQueryKeys: [queryKeys.stockBalances.all, queryKeys.stockTransactions.all],
  });
  const categories = useCrudResource(
    loadCategories,
    'Không thể tải danh mục vật tư.',
    queryKeys.supplyCategories.lookup({ pageSize: 100, isActive: true }),
  );
  const units = useCrudResource(
    loadUnits,
    'Không thể tải đơn vị tính.',
    queryKeys.units.lookup({ pageSize: 100, isActive: true }),
  );
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const [editing, setEditing] = useState<Supply | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: CreateSupplyInput) => {
    const ok = await resource.runMutation(
      () => editing ? updateSupply(editing.id, values) : createSupply(values),
      editing ? 'Đã cập nhật vật tư.' : 'Đã tạo vật tư.',
      editing ? 'Không thể cập nhật vật tư.' : 'Không thể tạo vật tư.',
    );
    if (ok) setFormOpen(false);
  };

  const columns: Column<Supply>[] = [
    { header: 'Mã', accessor: 'code', sortKey: 'code' },
    { header: 'Mô tả', accessor: 'description', sortKey: 'description', render: (item) => item.description || '—' },
    { header: 'Danh mục', accessor: 'category_id', render: (item) => item.category ? `${item.category.code}${item.category.description ? ` - ${item.category.description}` : ''}` : '—' },
    { header: 'Đơn vị', accessor: 'unit_id', render: (item) => item.unit?.symbol ?? item.unit?.code ?? '—' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active && !item.is_deleted} /> },
    ...(canMutate ? [{ header: 'Thao tác', accessor: 'actions', render: (item: Supply) => <RowActions onEdit={() => { setEditing(item); setFormOpen(true); }} onDelete={() => setDeleteTarget(item)} /> }] : []),
  ];

  return <div className="space-y-6">
    <CrudPageHeader title="Supplies" description="Danh mục vật tư dùng cho tồn kho và order." createLabel="Thêm vật tư" onCreate={canMutate ? () => { setEditing(null); setFormOpen(true); } : undefined} />
    <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
    {resource.error ? <ErrorState message={resource.error} onRetry={resource.reload} /> : <DataTable
      columns={columns}
      data={resource.items}
      loading={resource.loading}
      loadingText="Đang tải danh sách vật tư..."
      keyExtractor={(item) => item.id}
      searchPlaceholder="Tìm mã hoặc mô tả vật tư..."
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      pagination={resource.pagination}
      onPageChange={resource.setPage}
      onPageSizeChange={resource.setPageSize}
      sortBy={resource.query.sortBy}
      sortOrder={resource.query.sortOrder}
      onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
      renderTopToolbar={() => <>
        <select value={resource.query.categoryId ?? ''} onChange={(event) => resource.updateQuery({ categoryId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả danh mục</option>{categories.items.map((category) => <option key={category.id} value={category.id}>{category.code}</option>)}</select>
        <select value={resource.query.unitId ?? ''} onChange={(event) => resource.updateQuery({ unitId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả đơn vị</option>{units.items.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select>
        <select value={resource.query.isActive === undefined ? '' : String(resource.query.isActive)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === '' ? undefined : event.target.value === 'true' })} className={inputClassName}><option value="">Tất cả trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></select>
      </>}
      emptyText="Không có vật tư phù hợp."
    />}
    {formOpen && canMutate && <CrudModal title={editing ? 'Chỉnh sửa vật tư' : 'Tạo vật tư'} busy={resource.mutating} onClose={() => setFormOpen(false)}><SupplyForm key={editing?.id ?? 'create'} item={editing} busy={resource.mutating} categories={categories.items} categoriesLoading={categories.loading} categoriesError={categories.error} units={units.items} unitsLoading={units.loading} unitsError={units.error} onCancel={() => setFormOpen(false)} onSave={save} /></CrudModal>}
    {deleteTarget && canMutate && <ConfirmDialog title="Ngừng hoạt động vật tư?" message={`Vật tư “${deleteTarget.code}” sẽ được soft delete/deactivate theo rule backend.`} confirmLabel="Deactivate" busy={resource.mutating} onCancel={() => setDeleteTarget(null)} onConfirm={() => void resource.runMutation(() => deactivateSupply(deleteTarget.id), 'Đã deactivate vật tư.', 'Không thể deactivate vật tư.', { removeCurrentItem: resource.query.isActive === true || resource.query.isDeleted === false }).then((ok) => { if (ok) setDeleteTarget(null); })} />}
  </div>;
};

export default SuppliesPage;
