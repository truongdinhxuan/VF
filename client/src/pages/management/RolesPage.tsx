import { useCallback,useEffect,useState,type MouseEvent } from 'react';
import { listPermissions } from '../../api/permissions.service';
import {
createRole,deleteRole,getRolePermissions,listRoles,
replaceRolePermissions,updateRole,
} from '../../api/roles.service';
import { TextButton } from '../../components/common/Button';
import { DataTable,type Column } from '../../components/common/DataTable';
import { CrudEntityView } from '../../components/crud/CrudEntityView';
import {
CrudFeedbackToast,CrudModal,CrudPageHeader,ErrorState,
FormActions,
RowActions,StatusBadge
} from '../../components/crud/CrudPrimitives';
import { PrimaryCrudDrawer } from '../../components/crud/PrimaryCrudDrawer';
import { RoleForm,type RoleFormValues } from '../../components/forms/RoleForm';
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { PaginationParams } from '../../types/pagination.types';
import type { Permission } from '../../types/permissions';
import type { CreateRoleInput,Role,RoleListParams,UpdateRoleInput } from '../../types/roles';

type RoleQuery = RoleListParams & PaginationParams;
const initialQuery: RoleQuery = { page: 1, pageSize: 20, sortBy: 'code', sortOrder: 'asc' };

const RolesPage = () => {
  const { openConfirm } = useCrudOffcanvas();
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
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const openView = useCallback((item: Role) => {
    setEditing(item); setViewing(true); setFormError(null); setFormOpen(true);
  }, []);
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
    setFormError(null);
    try {
      const input: CreateRoleInput = {
        code: values.code, name: values.name,
        description: values.description || null, is_active: values.is_active,
      };
      const ok = await resource.runMutation(
        editing ? () => updateRole(editing.id, input satisfies UpdateRoleInput) : () => createRole(input),
        editing ? 'Đã cập nhật role.' : 'Đã tạo role.',
        editing ? 'Không thể cập nhật role.' : 'Không thể tạo role.',
        { throwOnError: true },
      );
      if (ok) setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại.');
    }
  };

  const confirmDelete = (role: Role, event: MouseEvent<HTMLButtonElement>) => openConfirm({
    title: 'Xóa role?',
    description: `Role “${role.name}” chỉ được xóa khi chưa được sử dụng.`,
    confirmLabel: 'Xóa role',
    cancelLabel: 'Quay lại',
    variant: 'danger',
    triggerElement: event.currentTarget,
    onConfirm: () => resource.runMutation(
      () => deleteRole(role.id),
      'Đã xóa role.',
      'Không thể xóa role.',
      { removeCurrentItem: true, throwOnError: true },
    ),
  });

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
    ...[{
      header: 'Thao tác', accessor: 'actions', render: (item: Role) => (
        <div className="flex justify-end gap-2">
          {canAssign && <button type="button" className={TextButton} onClick={() => void openPermissionMatrix(item)}>Permissions</button>}
          <RowActions
            onView={() => openView(item)} onEdit={canUpdate ? () => { setEditing(item); setViewing(false); setFormError(null); setFormOpen(true); } : undefined}
            onDelete={!canUpdate || item.is_system ? undefined : (event) => confirmDelete(item, event)}
            deleteLabel="Xóa"
          />
        </div>
      ),
    }],
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader title="Roles" description="Role động và permission matrix theo catalog hệ thống." createLabel="Thêm role" onCreate={canCreate ? () => { setEditing(null); setViewing(false); setFormError(null); setFormOpen(true); } : undefined} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id}
          searchPlaceholder="Tìm code, tên hoặc mô tả..." searchValue={search} onSearchChange={setSearch}
          pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Không có role phù hợp." />
      )}
      {formOpen && (viewing || (editing ? canUpdate : canCreate)) && (
        <PrimaryCrudDrawer mode={viewing ? 'view' : editing ? 'edit' : 'create'} size="md" onEdit={viewing && canUpdate ? () => setViewing(false) : undefined} error={formError} title={viewing ? 'Chi tiết role' : (editing ? 'Chỉnh sửa role' : 'Tạo role')} busy={resource.mutating} onClose={() => setFormOpen(false)}>
          {viewing && editing ? <CrudEntityView fields={[
            { label: 'Mã', value: editing.code },
            { label: 'Tên', value: editing.name },
            { label: 'Mô tả', value: editing.description, fullWidth: true },
            { label: 'Loại', value: editing.is_system ? 'Hệ thống' : 'Tùy chỉnh' },
            { label: 'Trạng thái', value: <StatusBadge active={editing.is_active && !editing.is_deleted} /> },
            { label: 'Ngày tạo', value: new Date(editing.created_at).toLocaleString('vi-VN') },
            { label: 'Cập nhật', value: new Date(editing.updated_at).toLocaleString('vi-VN') },
          ]} /> : (<RoleForm key={editing?.id ?? 'create'} role={editing} busy={resource.mutating} onSave={save} />)}
        </PrimaryCrudDrawer>
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
