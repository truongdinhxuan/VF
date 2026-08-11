import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createMilkrunRack,
  deactivateMilkrunRack,
  listMilkrunRacks,
  updateMilkrunRack,
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
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunLookupListParams, MilkrunRack, MilkrunRackInput } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type RackQuery = MilkrunLookupListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const RackForm = ({
  item,
  busy,
  onCancel,
  onSave,
}: {
  item: MilkrunRack | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: MilkrunRackInput) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<MilkrunRackInput>({
    defaultValues: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      image_url: item?.image_url ?? '',
      is_active: item?.is_active ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <label className={labelClassName}>
        Code *
        <input
          {...register('code', { required: 'Vui lòng nhập code.' })}
          className={inputClassName}
          autoFocus
        />
        <FieldError message={errors.code?.message} />
      </label>
      <label className={labelClassName}>
        Tên rack *
        <input
          {...register('name', { required: 'Vui lòng nhập tên rack.' })}
          className={inputClassName}
        />
        <FieldError message={errors.name?.message} />
      </label>
      <label className={labelClassName}>
        Image URL
        <input {...register('image_url')} className={inputClassName} placeholder="https://..." />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" {...register('is_active')} />
        Đang hoạt động
      </label>
      <FormActions busy={busy} onCancel={onCancel} submitLabel={item ? 'Lưu thay đổi' : 'Tạo rack'} />
    </form>
  );
};

const RacksPage = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSION_CODE.MILKRUN_RACK_CREATE);
  const canUpdate = hasPermission(PERMISSION_CODE.MILKRUN_RACK_UPDATE);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [editing, setEditing] = useState<MilkrunRack | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<MilkrunRack | null>(null);
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
    );
    if (ok) setFormOpen(false);
  };

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
    ...(canUpdate ? [{
      header: 'Thao tác',
      accessor: 'actions',
      render: (rack: MilkrunRack) => (
        <RowActions
          onEdit={() => { setEditing(rack); setFormOpen(true); }}
          onDelete={rack.is_active ? () => setDeactivateTarget(rack) : undefined}
          deleteLabel="Deactivate"
        />
      ),
    }] : []),
  ], [canUpdate]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title="Rack"
        description="Danh mục Rack dùng riêng cho nghiệp vụ Milkrun."
        createLabel="Thêm rack"
        onCreate={canCreate ? () => { setEditing(null); setFormOpen(true); } : undefined}
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
      {formOpen && (editing ? canUpdate : canCreate) && (
        <CrudModal title={editing ? 'Chỉnh sửa Rack' : 'Tạo Rack'} busy={resource.mutating} onClose={() => setFormOpen(false)}>
          <RackForm item={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} />
        </CrudModal>
      )}
      {deactivateTarget && canUpdate && (
        <ConfirmDialog
          title="Deactivate Rack?"
          message={`Rack “${deactivateTarget.code}” sẽ không còn xuất hiện trong dropdown active.`}
          confirmLabel="Deactivate"
          busy={resource.mutating}
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() => void resource.runMutation(
            () => deactivateMilkrunRack(deactivateTarget.id),
            'Đã deactivate Rack.',
            'Không thể deactivate Rack.',
            { removeCurrentItem: resource.query.isActive === true },
          ).then((ok) => { if (ok) setDeactivateTarget(null); })}
        />
      )}
    </section>
  );
};

export default RacksPage;
