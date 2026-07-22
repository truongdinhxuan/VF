import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from '../../../api/roles.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
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
  LoadingState,
  RowActions,
} from '../../../components/admin/crud/CrudPrimitives';
import { ROLE_NAMES, type RoleName } from '../../../constants/roles';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import type { PaginationParams } from '../../../types/pagination.types';
import type { Role, RoleListParams } from '../../../types/roles';

interface RoleFormValues {
  role_name: RoleName;
}

type RoleQuery = RoleListParams & PaginationParams;
const initialQuery: RoleQuery = {
  page: 1,
  pageSize: 20,
  sortBy: 'role_name',
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
    defaultValues: { role_name: role?.role_name ?? ROLE_NAMES[0] },
  });

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <label className={labelClassName}>
        <span>Tên role</span>
        <select {...register('role_name', { required: 'Vui lòng chọn role.' })} className={inputClassName}>
          {ROLE_NAMES.map((roleName) => (
            <option key={roleName} value={roleName}>{roleName}</option>
          ))}
        </select>
        <FieldError message={errors.role_name?.message} />
      </label>
      <p className="mt-3 text-xs text-slate-500">Role được giới hạn theo cấu hình nghiệp vụ hiện tại của hệ thống.</p>
      <FormActions busy={busy} onCancel={onCancel} submitLabel={role ? 'Lưu thay đổi' : 'Tạo role'} />
    </form>
  );
};

const RolesPage = () => {
  const loader = useCallback((query: RoleQuery, signal: AbortSignal) => listRoles(query, signal), []);
  const resource = usePaginatedResource<Role, RoleQuery>({
    loader,
    initialQuery,
    loadErrorMessage: 'Không thể tải danh sách role.',
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  useEffect(() => {
    if ((resource.query.search ?? '') !== debouncedSearch.trim()) {
      resource.updateQuery({ search: debouncedSearch.trim() || undefined });
    }
  }, [debouncedSearch, resource.query.search, resource.updateQuery]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const save = async (values: RoleFormValues) => {
    const succeeded = await resource.runMutation(
      () => editing ? updateRole(editing.id, values) : createRole(values),
      editing ? 'Đã cập nhật role.' : 'Đã tạo role.',
      editing ? 'Không thể cập nhật role.' : 'Không thể tạo role.',
    );
    if (succeeded) setFormOpen(false);
  };

  const columns: Column<Role>[] = [
    { header: 'Tên role', accessor: 'role_name', sortKey: 'role_name' },
    {
      header: 'Thao tác',
      accessor: 'actions',
      render: (role) => (
        <RowActions
          deleteLabel="Xóa"
          onEdit={() => { setEditing(role); setFormOpen(true); }}
          onDelete={() => setDeleteTarget(role)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader title="Roles" description="Quản lý các vai trò được phép sử dụng trong hệ thống." onCreate={openCreate} createLabel="Thêm role" />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.loading ? <LoadingState /> : resource.error ? (
        <ErrorState message={resource.error} onRetry={() => void resource.reload()} />
      ) : (
        <DataTable
          columns={columns}
          data={resource.items}
          keyExtractor={(role) => role.id}
          searchPlaceholder="Tìm role..."
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
      {formOpen && (
        <CrudModal title={editing ? 'Chỉnh sửa role' : 'Tạo role'} busy={resource.mutating} onClose={() => setFormOpen(false)}>
          <RoleForm key={editing?.id ?? 'create'} role={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} />
        </CrudModal>
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Xóa role?"
          message={`Role “${deleteTarget.role_name}” chỉ được xóa khi chưa được sử dụng.`}
          confirmLabel="Xóa role"
          busy={resource.mutating}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void resource.runMutation(
            () => deleteRole(deleteTarget.id),
            'Đã xóa role.',
            'Không thể xóa role.',
            { removeCurrentItem: true },
          ).then((ok) => { if (ok) setDeleteTarget(null); })}
        />
      )}
    </div>
  );
};

export default RolesPage;
