import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { listAreas } from '../../api/areas.service';
import { listRoles } from '../../api/roles.service';
import { createUser, deactivateUser, getUsers, updateUser } from '../../api/users.service';
import { TextButton } from '../../components/common/Button';
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
import { SelectSkeleton } from '../../components/common/skeleton';
import { USER_MANAGEMENT_ROLES } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { useCrudResource } from '../../hooks/useCrudResource';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { useServerLookup } from '../../hooks/useServerLookup';
import { queryKeys } from '../../lib/queryKeys';
import type { Area } from '../../types/areas';
import type { PaginationParams } from '../../types/pagination.types';
import type { Role } from '../../types/roles';
import type { CreateUserInput, UpdateUserInput, UserListParams, UserProfile } from '../../types/users';

type UserQuery = UserListParams & PaginationParams;

interface UserFormValues {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  vinfast_id: number;
  phone_number: string;
  avatar_url: string;
  role_id: string;
  area_id: string;
  managed_by_user_id: string;
  is_active: boolean;
  is_verified: boolean;
}

interface UserReferenceData {
  roles: Role[];
  areas: Area[];
  users: UserProfile[];
  managerSearch: string;
  setManagerSearch: (value: string) => void;
  loading: boolean;
  errors: string[];
}

const loadRoles = async (signal: AbortSignal) =>
  (await listRoles(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;
const loadAreas = async (signal: AbortSignal) =>
  (await listAreas(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;

const getRoleName = (user: UserProfile): string => {
  if (typeof user.role === 'string') return user.role;
  return user.role ? `${user.role.name} (${user.role.code})` : '—';
};

const UserForm = ({ user, references, busy, onCancel, onSave }: {
  user: UserProfile | null;
  references: UserReferenceData;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: UserFormValues) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<UserFormValues>({
    defaultValues: {
      email: user?.email ?? '',
      password: '',
      confirm_password: '',
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      vinfast_id: user?.vinfast_id ?? 0,
      phone_number: user?.phone_number ?? '',
      avatar_url: user?.avatar_url ?? '',
      role_id: user?.role_id ?? '',
      area_id: user?.area_id ?? '',
      managed_by_user_id: user?.managed_by_user_id ?? '',
      is_active: user?.is_active ?? true,
      is_verified: user?.is_verified ?? false,
    },
  });
  const referencesUnavailable = references.loading || references.errors.length > 0
    || references.roles.length === 0 || references.areas.length === 0;

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-5">
      {references.errors.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {references.errors.map((message) => <p key={message}>{message}</p>)}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          <span>Họ</span>
          <input {...register('first_name', { required: 'Vui lòng nhập họ.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
          <FieldError message={errors.first_name?.message} />
        </label>
        <label className={labelClassName}>
          <span>Tên</span>
          <input {...register('last_name', { required: 'Vui lòng nhập tên.', setValueAs: (value: string) => value.trim() })} className={inputClassName} />
          <FieldError message={errors.last_name?.message} />
        </label>
        <label className={labelClassName}>
          <span>Email</span>
          <input type="email" autoComplete="off" {...register('email', { required: 'Vui lòng nhập email.', setValueAs: (value: string) => value.trim().toLowerCase() })} className={inputClassName} />
          <FieldError message={errors.email?.message} />
        </label>
        <label className={labelClassName}>
          <span>VinFast ID</span>
          <input type="number" {...register('vinfast_id', { required: 'Vui lòng nhập VinFast ID.', valueAsNumber: true, validate: (value) => Number.isInteger(value) || 'VinFast ID phải là số nguyên.' })} className={inputClassName} />
          <FieldError message={errors.vinfast_id?.message} />
        </label>
        {!user && (
          <>
            <label className={labelClassName}>
              <span>Mật khẩu ban đầu</span>
              <input type="password" autoComplete="new-password" {...register('password', {
                required: 'Vui lòng nhập mật khẩu.',
                minLength: { value: 9, message: 'Mật khẩu phải có ít nhất 9 ký tự.' },
                maxLength: { value: 128, message: 'Mật khẩu không được vượt quá 128 ký tự.' },
                validate: (value) =>
                  (/[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value))
                  || 'Mật khẩu cần có chữ hoa, số và ký tự đặc biệt.',
              })} className={inputClassName} />
              <FieldError message={errors.password?.message} />
            </label>
            <label className={labelClassName}>
              <span>Xác nhận mật khẩu</span>
              <input type="password" autoComplete="new-password" {...register('confirm_password', { required: 'Vui lòng xác nhận mật khẩu.', validate: (value) => value === getValues('password') || 'Mật khẩu xác nhận không khớp.' })} className={inputClassName} />
              <FieldError message={errors.confirm_password?.message} />
            </label>
          </>
        )}
        <label className={labelClassName}>
          <span>Role</span>
          {references.loading && references.roles.length === 0 ? <SelectSkeleton label="Đang tải role" /> : <select {...register('role_id', { required: 'Vui lòng chọn role.' })} className={inputClassName}>
            <option value="">Chọn role</option>
            {references.roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.code})</option>)}
          </select>}
          {!references.loading && references.roles.length === 0 ? <FieldError message="Không có role để lựa chọn." /> : <FieldError message={errors.role_id?.message} />}
        </label>
        <label className={labelClassName}>
          <span>Area</span>
          {references.loading && references.areas.length === 0 ? <SelectSkeleton label="Đang tải area" /> : <select {...register('area_id', { required: 'Vui lòng chọn area.' })} className={inputClassName}>
            <option value="">Chọn area</option>
            {references.areas.map((area) => <option key={area.id} value={area.id}>{area.code} - {area.name}</option>)}
          </select>}
          {!references.loading && references.areas.length === 0 ? <FieldError message="Không có area active để lựa chọn." /> : <FieldError message={errors.area_id?.message} />}
        </label>
        <label className={labelClassName}>
          <span>Người quản lý</span>
          <input
            type="search"
            value={references.managerSearch}
            onChange={(event) => references.setManagerSearch(event.target.value)}
            placeholder="Tìm người quản lý trên server..."
            className={inputClassName}
          />
          {references.loading && references.users.length === 0 ? <SelectSkeleton label="Đang tải người quản lý" /> : <select {...register('managed_by_user_id')} className={inputClassName}>
            <option value="">Không chọn</option>
            {references.users.filter((candidate) => candidate.id !== user?.id && candidate.is_active).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name} ({candidate.email})</option>
            ))}
          </select>}
        </label>
        <label className={labelClassName}>
          <span>Số điện thoại</span>
          <input type="tel" {...register('phone_number')} className={inputClassName} />
        </label>
        <label className={labelClassName}>
          <span>Avatar URL</span>
          <input type="url" {...register('avatar_url')} className={inputClassName} />
        </label>
      </div>
      {user && (
        <div className="flex flex-wrap gap-5 rounded-xl bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" /> Đang hoạt động</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('is_verified')} className="h-4 w-4 rounded border-slate-300" /> Đã duyệt tài khoản</label>
        </div>
      )}
      <FormActions busy={busy || referencesUnavailable} onCancel={onCancel} submitLabel={user ? 'Lưu thay đổi' : 'Tạo người dùng'} />
    </form>
  );
};

const UsersPage = () => {
  const { role: currentRole } = useAuth();
  const canMutate = currentRole !== null && USER_MANAGEMENT_ROLES.includes(currentRole);
  const loader = useCallback((query: UserQuery, signal: AbortSignal) => getUsers(query, signal), []);
  const resource = usePaginatedResource<UserProfile, UserQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải danh sách người dùng.',
    queryKey: queryKeys.users.lists,
  });
  const roles = useCrudResource(
    loadRoles,
    'Không thể tải danh sách role.',
    queryKeys.roles.lookup({ pageSize: 100 }),
  );
  const areas = useCrudResource(
    loadAreas,
    'Không thể tải danh sách area.',
    queryKeys.areas.lookup({ pageSize: 100, isActive: true }),
  );
  const managerLoader = useCallback(
    (search: string | undefined, signal: AbortSignal) =>
      getUsers(
        { page: 1, pageSize: 20, search, isActive: true, sortBy: 'first_name', sortOrder: 'asc' },
        signal,
      ),
    [],
  );
  const managers = useServerLookup({
    loader: managerLoader,
    queryKey: (search) => queryKeys.users.lookup({ search, pageSize: 20, isActive: true }),
    errorMessage: 'Không thể tải danh sách người quản lý.',
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserProfile | null>(null);

  const references: UserReferenceData = {
    roles: roles.items,
    areas: areas.items,
    users: managers.items,
    managerSearch: managers.search,
    setManagerSearch: managers.setSearch,
    loading: roles.loading || areas.loading || managers.loading,
    errors: [roles.error, areas.error, managers.error].filter((error): error is string => Boolean(error)),
  };

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const save = async (values: UserFormValues) => {
    const commonInput = {
      email: values.email,
      first_name: values.first_name,
      last_name: values.last_name,
      vinfast_id: values.vinfast_id,
      phone_number: values.phone_number.trim() || null,
      avatar_url: values.avatar_url.trim() || null,
      role_id: values.role_id,
      area_id: values.area_id,
      managed_by_user_id: values.managed_by_user_id || null,
    };
    const action = editing
      ? () => updateUser(editing.id, { ...commonInput, is_active: values.is_active, is_verified: values.is_verified } satisfies UpdateUserInput)
      : () => createUser({ ...commonInput, password: values.password } satisfies CreateUserInput);
    const ok = await resource.runMutation(
      action,
      editing ? 'Đã cập nhật người dùng.' : 'Đã tạo tài khoản nội bộ. Tài khoản đang chờ duyệt.',
      editing ? 'Không thể cập nhật người dùng.' : 'Không thể tạo người dùng.',
    );
    if (ok) setFormOpen(false);
  };

  const columns: Column<UserProfile>[] = [
    { header: 'Email', accessor: 'email', sortKey: 'email' },
    { header: 'VinFast ID', accessor: 'vinfast_id', sortKey: 'vinfast_id' },
    { header: 'Họ và tên', accessor: 'first_name', sortKey: 'first_name', render: (user) => `${user.first_name} ${user.last_name}`.trim() },
    { header: 'Role', accessor: 'role_id', render: getRoleName },
    { header: 'Area', accessor: 'area_id', render: (user) => user.area ? `${user.area.code} - ${user.area.name}` : '—' },
    { header: 'Active', accessor: 'is_active', sortKey: 'is_active', render: (user) => <StatusBadge active={user.is_active} /> },
    { header: 'Duyệt', accessor: 'is_verified', render: (user) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_verified ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{user.is_verified ? 'Đã duyệt' : 'Chờ duyệt'}</span> },
    ...(canMutate ? [{ header: 'Thao tác', accessor: 'actions', render: (user: UserProfile) => user.is_active ? (
      <RowActions onEdit={() => { setEditing(user); setFormOpen(true); }} onDelete={() => setDeactivateTarget(user)} />
    ) : (
      <div className="flex justify-end"><button type="button" onClick={() => { setEditing(user); setFormOpen(true); }} className={TextButton}>Sửa / kích hoạt</button></div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <CrudPageHeader title="Users" description="Quản lý hồ sơ, role, khu vực và trạng thái duyệt tài khoản." createLabel="Thêm người dùng" onCreate={canMutate ? () => { setEditing(null); setFormOpen(true); } : undefined} />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {resource.error ? (
        <ErrorState message={resource.error} onRetry={() => void resource.reload()} />
      ) : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(user) => user.id}
          searchPlaceholder="Tìm email, VinFast ID hoặc tên..."
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          renderTopToolbar={() => <>
            <select value={resource.query.roleId ?? ''} onChange={(event) => resource.updateQuery({ roleId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả role</option>{roles.items.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.code})</option>)}</select>
            <select value={resource.query.areaId ?? ''} onChange={(event) => resource.updateQuery({ areaId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả area</option>{areas.items.map((area) => <option key={area.id} value={area.id}>{area.code}</option>)}</select>
            <select value={resource.query.isActive === undefined ? '' : String(resource.query.isActive)} onChange={(event) => resource.updateQuery({ isActive: event.target.value === '' ? undefined : event.target.value === 'true' })} className={inputClassName}><option value="">Tất cả trạng thái</option><option value="true">Active</option><option value="false">Inactive</option></select>
          </>}
          emptyText="Không có người dùng phù hợp."
        />
      )}
      {formOpen && canMutate && (
        <CrudModal title={editing ? 'Chỉnh sửa người dùng' : 'Tạo người dùng'} busy={resource.mutating} onClose={() => setFormOpen(false)}>
          <UserForm key={editing?.id ?? 'create'} user={editing} references={references} busy={resource.mutating} onCancel={() => setFormOpen(false)} onSave={save} />
        </CrudModal>
      )}
      {deactivateTarget && canMutate && (
        <ConfirmDialog title="Deactivate người dùng?" message={`Tài khoản “${deactivateTarget.email}” sẽ không còn được phép truy cập dữ liệu nội bộ.`} confirmLabel="Deactivate" busy={resource.mutating} onCancel={() => setDeactivateTarget(null)} onConfirm={() => void resource.runMutation(() => deactivateUser(deactivateTarget.id), 'Đã deactivate người dùng.', 'Không thể deactivate người dùng.', { removeCurrentItem: resource.query.isActive === true }).then((ok) => { if (ok) setDeactivateTarget(null); })} />
      )}
    </div>
  );
};

export default UsersPage;
