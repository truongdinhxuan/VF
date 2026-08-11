import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { listPermissions } from '../../api/permissions.service';
import {
  createRole, deleteRole, getRolePermissions, listRoles,
  replaceRolePermissions, updateRole,
} from '../../api/roles.service';
import { TextButton } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import {
  ConfirmDialog, CrudFeedbackToast, CrudModal, CrudPageHeader, ErrorState,
  FieldError, FormActions, inputClassName, labelClassName, RowActions, StatusBadge,
} from '../../components/crud/CrudPrimitives';
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { PaginationParams } from '../../types/pagination.types';
import type { Permission } from '../../types/permissions';
import type { CreateRoleInput, Role, RoleListParams, UpdateRoleInput } from '../../types/roles';

interface RoleFormValues {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

type RoleQuery = RoleListParams & PaginationParams;
const initialQuery: RoleQuery = { page: 1, pageSize: 20, sortBy: 'code', sortOrder: 'asc' };

const RoleForm = ({ role, busy, onCancel, onSave }: {
  role: Role | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: RoleFormValues) => Promise<void>;
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<RoleFormValues>({
    defaultValues: {
      code: role?.code ?? '', name: role?.name ?? '',
      description: role?.description ?? '', is_active: role?.is_active ?? true,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <label className={labelClassName}>
        <span>Code</span>
        <input {...register('code', {
          required: 'Vui lòng nhập role code.',
          pattern: { value: /^[A-Z][A-Z0-9_]*$/, message: 'Code chỉ gồm A-Z, số và dấu gạch dưới.' },
          setValueAs: (value: string) => value.trim().toUpperCase(),
        })} disabled={Boolean(role?.is_system)} className={inputClassName} />
        <FieldError message={errors.code?.message} />
      </label>
      <label className={labelClassName}>
        <span>Tên hiển thị</span>
        <input {...register('name', { required: 'Vui lòng nhập tên role.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
        <FieldError message={errors.name?.message} />
      </label>
      <label className={labelClassName}>
        <span>Mô tả</span>
        <textarea {...register('description', { setValueAs: (value: string) => value.trim() })} rows={3} className={inputClassName} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" {...register('is_active')} disabled={Boolean(role?.is_system)} className="h-4 w-4 rounded border-slate-300" />
        Đang hoạt động
      </label>
      {role?.is_system && <p className="text-xs text-slate-500">Role hệ thống không cho phép đổi code hoặc xóa.</p>}
      <FormActions busy={busy} onCancel={onCancel} submitLabel={role ? 'Lưu thay đổi' : 'Tạo role'} />
    </form>
  );
};

const RolesPage = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSION_CODE.ADMIN_ROLE_CREATE);
  const canUpdate = hasPermission(PERMISSION_CODE.ADMIN_ROLE_UPDATE);
  const canAssign = hasPermission(PERMISSION_CODE.ADMIN_ROLE_ASSIGN_PERMISSION);
  const loader = useCallback((query: RoleQuery, signal: AbortSignal) => listRoles(query, signal), []);
  const resource = usePaginatedResource<Role, RoleQuery>({
    loader, initialQuery, loadErrorMessage: 'Không thể tải danh sách role.',
    queryKey: queryKeys.roles.lists,
    invalidateQueryKeys: [queryKeys.users.all, queryKeys.rolePermissions.all, queryKeys.userRoles.all],
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [editing, setEditing] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const next = debouncedSearch.trim() || undefined;
    if (resourceSearch !== next) updateResourceQuery({ search: next });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: RoleFormValues) => {
    const input: CreateRoleInput = {
      code: values.code, name: values.name,
      description: values.description || null, is_active: values.is_active,
    };
    const ok = await resource.runMutation(
      editing ? () => updateRole(editing.id, input satisfies UpdateRoleInput) : () => createRole(input),
      editing ? 'Đã cập nhật role.' : 'Đã tạo role.',
      editing ? 'Không thể cập nhật role.' : 'Không thể tạo role.',
    );
    if (ok) setFormOpen(false);
  };

  const openPermissionMatrix = async (target: Role) => {
    setPermissionTarget(target);
    setPermissionLoading(true);
    setPermissionError(null);
    try {
      const [catalog, assigned] = await Promise.all([
        listPermissions({ page: 1, pageSize: 100, sortBy: 'module', sortOrder: 'asc' }),
        getRolePermissions(target.id),
      ]);
      setPermissions(catalog.data);
      setSelectedPermissionIds(assigned.map((permission) => permission.id));
    } catch {
      setPermissionError('Không thể tải permission matrix.');
    } finally {
      setPermissionLoading(false);
    }
  };

  const columns: Column<Role>[] = [
    { header: 'Code', accessor: 'code', sortKey: 'code' },
    { header: 'Tên', accessor: 'name', sortKey: 'name' },
    { header: 'Mô tả', accessor: 'description', render: (item) => item.description || '—' },
    { header: 'Loại', accessor: 'is_system', render: (item) => item.is_system ? 'Hệ thống' : 'Tùy chỉnh' },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active && !item.is_deleted} /> },
    ...((canUpdate || canAssign) ? [{
      header: 'Thao tác', accessor: 'actions', render: (item: Role) => (
        <div className="flex justify-end gap-2">
          {canAssign && <button type="button" className={TextButton} onClick={() => void openPermissionMatrix(item)}>Permissions</button>}
          {canUpdate && <RowActions
            onEdit={() => { setEditing(item); setFormOpen(true); }}
            onDelete={item.is_system ? undefined : () => setDeleteTarget(item)}
          />}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader title="Roles" description="Role động và permission matrix theo catalog hệ thống." createLabel="Thêm role" onCreate={canCreate ? () => { setEditing(null); setFormOpen(true); } : undefined} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id}
          searchPlaceholder="Tìm code, tên hoặc mô tả..." searchValue={search} onSearchChange={setSearch}
          pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Không có role phù hợp." />
      )}
      {formOpen && (editing ? canUpdate : canCreate) && (
        <CrudModal title={editing ? 'Chỉnh sửa role' : 'Tạo role'} busy={resource.mutating} onClose={() => setFormOpen(false)}>
          <RoleForm key={editing?.id ?? 'create'} role={editing} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} />
        </CrudModal>
      )}
      {deleteTarget && canUpdate && (
        <ConfirmDialog title="Xóa role?" message={`Role “${deleteTarget.name}” chỉ được xóa khi chưa được sử dụng.`}
          confirmLabel="Xóa role" busy={resource.mutating} onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void resource.runMutation(() => deleteRole(deleteTarget.id), 'Đã xóa role.', 'Không thể xóa role.', { removeCurrentItem: true }).then((ok) => { if (ok) setDeleteTarget(null); })} />
      )}
      {permissionTarget && canAssign && (
        <CrudModal title={`Permissions — ${permissionTarget.name}`} busy={resource.mutating || permissionLoading} onClose={() => setPermissionTarget(null)}>
          {permissionError ? <ErrorState message={permissionError} onRetry={() => void openPermissionMatrix(permissionTarget)} /> : permissionLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Đang tải permission matrix...</p>
          ) : (
            <form className="space-y-5" onSubmit={(event) => {
              event.preventDefault();
              void resource.runMutation(() => replaceRolePermissions(permissionTarget.id, selectedPermissionIds), 'Đã cập nhật permission của role.', 'Không thể cập nhật permission của role.').then((ok) => { if (ok) setPermissionTarget(null); });
            }}>
              {[...new Set(permissions.map((permission) => permission.module))].map((module) => (
                <fieldset key={module} className="rounded-xl border border-slate-200 p-4">
                  <legend className="px-2 text-sm font-bold text-slate-800">{module}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {permissions.filter((permission) => permission.module === module).map((permission) => (
                      <label key={permission.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                        <input type="checkbox" checked={selectedPermissionIds.includes(permission.id)}
                          onChange={(event) => setSelectedPermissionIds((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))}
                          className="mt-1 h-4 w-4 rounded border-slate-300" />
                        <span><span className="block text-sm font-semibold text-slate-800">{permission.name}</span><span className="block text-xs text-slate-500">{permission.code}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <FormActions busy={resource.mutating} onCancel={() => setPermissionTarget(null)} submitLabel="Lưu permissions" />
            </form>
          )}
        </CrudModal>
      )}
    </div>
  );
};

export default RolesPage;
