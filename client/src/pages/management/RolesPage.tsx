import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from '../../api/roles.service';
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
import {
  ROLE_CODES,
  SYSTEM_MANAGEMENT_ROLES,
  type RoleCode,
} from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { PaginationParams } from '../../types/pagination.types';
import type {
  CreateRoleInput,
  Role,
  RoleListParams,
  UpdateRoleInput,
} from '../../types/roles';

interface RoleFormValues {
  code: RoleCode;
  name: string;
  description: string;
  is_active: boolean;
}

type RoleQuery = RoleListParams & PaginationParams;

const initialQuery: RoleQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'code',
  sortOrder: 'asc',
};

const RoleForm = ({
  role,
  busy,
  onCancel,
  onSave,
}: {
  role: Role | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: RoleFormValues) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormValues>({
    defaultValues: {
      code: role?.code ?? ROLE_CODES[0],
      name: role?.name ?? '',
      description: role?.description ?? '',
      is_active: role?.is_active ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <label className={labelClassName}>
        <span>Code</span>
        <select
          {...register('code', { required: 'Vui lòng chọn role code.' })}
          disabled={Boolean(role?.is_system)}
          className={inputClassName}
        >
          {ROLE_CODES.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
        <FieldError message={errors.code?.message} />
      </label>
      <label className={labelClassName}>
        <span>Tên hiển thị</span>
        <input
          {...register('name', {
            required: 'Vui lòng nhập tên role.',
            setValueAs: (value: string) => value.trim(),
          })}
          className={inputClassName}
        />
        <FieldError message={errors.name?.message} />
      </label>
      <label className={labelClassName}>
        <span>Mô tả</span>
        <textarea
          {...register('description', {
            setValueAs: (value: string) => value.trim(),
          })}
          rows={3}
          className={inputClassName}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          {...register('is_active')}
          className="h-4 w-4 rounded border-slate-300"
        />
        Đang hoạt động
      </label>
      {role?.is_system && (
        <p className="text-xs text-slate-500">
          Role hệ thống không cho phép thay đổi code hoặc xóa.
        </p>
      )}
      <FormActions
        busy={busy}
        onCancel={onCancel}
        submitLabel={role ? 'Lưu thay đổi' : 'Tạo role'}
      />
    </form>
  );
};

const RolesPage = () => {
  const { role: currentRole } = useAuth();
  const canMutate = currentRole !== null && SYSTEM_MANAGEMENT_ROLES.includes(currentRole);
  const loader = useCallback(
    (query: RoleQuery, signal: AbortSignal) => listRoles(query, signal),
    [],
  );
  const resource = usePaginatedResource<Role, RoleQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh sách role.',
    queryKey: queryKeys.roles.lists,
    invalidateQueryKeys: [queryKeys.users.all],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const [editing, setEditing] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  useEffect(() => {
    const nextSearch = debouncedSearch.trim() || undefined;
    if (resourceSearch !== nextSearch) updateResourceQuery({ search: nextSearch });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: RoleFormValues) => {
    const input: CreateRoleInput = {
      code: values.code,
      name: values.name,
      description: values.description || null,
      is_active: values.is_active,
    };
    const action = editing
      ? () => updateRole(editing.id, input satisfies UpdateRoleInput)
      : () => createRole(input);
    const succeeded = await resource.runMutation(
      action,
      editing ? 'Đã cập nhật role.' : 'Đã tạo role.',
      editing ? 'Không thể cập nhật role.' : 'Không thể tạo role.',
    );
    if (succeeded) setFormOpen(false);
  };

  const columns: Column<Role>[] = [
    { header: 'Code', accessor: 'code', sortKey: 'code' },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    {
      header: 'Mô tả',
      accessor: 'description',
      render: (item) => item.description || '—',
    },
    {
      header: 'Loại',
      accessor: 'is_system',
      render: (item) => item.is_system ? 'Hệ thống' : 'Tùy chỉnh',
    },
    {
      header: 'Trạng thái',
      accessor: 'is_active',
      sortKey: 'is_active',
      render: (item) => <StatusBadge active={item.is_active && !item.is_deleted} />,
    },
    ...(canMutate ? [{
      header: 'Thao tác',
      accessor: 'actions',
      render: (item: Role) => (
        <RowActions
          onEdit={() => {
            setEditing(item);
            setFormOpen(true);
          }}
          onDelete={item.is_system ? undefined : () => setDeleteTarget(item)}
        />
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader
        title="Roles"
        description="Quản lý role bằng code nghiệp vụ; Material Control chỉ có quyền xem."
        createLabel="Thêm role"
        onCreate={canMutate ? () => {
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
          searchPlaceholder="Tìm code, tên hoặc mô tả..."
          searchValue={search}
          onSearchChange={setSearch}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Không có role phù hợp."
        />
      )}
      {formOpen && canMutate && (
        <CrudModal
          title={editing ? 'Chỉnh sửa role' : 'Tạo role'}
          busy={resource.mutating}
          onClose={() => setFormOpen(false)}
        >
          <RoleForm
            key={editing?.id ?? 'create'}
            role={editing}
            busy={resource.mutating}
            onCancel={() => setFormOpen(false)}
            onSave={save}
          />
        </CrudModal>
      )}
      {deleteTarget && canMutate && (
        <ConfirmDialog
          title="Xóa role?"
          message={`Role “${deleteTarget.name}” chỉ được xóa khi không phải role hệ thống và chưa được sử dụng.`}
          confirmLabel="Xóa role"
          busy={resource.mutating}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void resource.runMutation(
            () => deleteRole(deleteTarget.id),
            'Đã xóa role.',
            'Không thể xóa role.',
            { removeCurrentItem: true },
          ).then((ok) => {
            if (ok) setDeleteTarget(null);
          })}
        />
      )}
    </div>
  );
};

export default RolesPage;
