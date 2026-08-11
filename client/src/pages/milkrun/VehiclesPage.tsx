import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { listMilkrunVehicles, updateMilkrunVehicle } from '../../api/milkrun-master-data.service';
import { getUsers } from '../../api/users.service';
import { DataTable, type Column } from '../../components/common/DataTable';
import {
  CrudFeedbackToast,
  CrudModal,
  CrudPageHeader,
  ErrorState,
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
import type { MilkrunLookupListParams, MilkrunVehicle } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type VehicleQuery = MilkrunLookupListParams & PaginationParams;

interface AssignmentFormValues {
  driver_id: string;
}

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const VehiclesPage = () => {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(PERMISSION_CODE.MILKRUN_VEHICLE_ASSIGN);
  const canReadUsers = hasPermission(PERMISSION_CODE.ADMIN_USER_READ);
  const canOpenAssignment = canAssign && canReadUsers;
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const [assignmentTarget, setAssignmentTarget] = useState<MilkrunVehicle | null>(null);
  const loader = useCallback(
    (query: VehicleQuery, signal: AbortSignal) => listMilkrunVehicles(query, signal),
    [],
  );
  const resource = usePaginatedResource<MilkrunVehicle, VehicleQuery>({
    loader,
    initialQuery: {
      page: 1,
      pageSize: 20,
      sortBy: 'code',
      sortOrder: 'asc',
      isActive: true,
      isDeleted: false,
    },
    loadErrorMessage: 'Không thể tải danh sách xe.',
    queryKey: queryKeys.milkrunVehicles.lists,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const usersQuery = useQuery({
    queryKey: queryKeys.users.lookup({ active: true, verified: true, pageSize: 100 }),
    queryFn: ({ signal }) => getUsers({ page: 1, pageSize: 100, isActive: true }, signal),
    enabled: canOpenAssignment,
    staleTime: 5 * 60 * 1000,
  });
  const { register, handleSubmit, reset } = useForm<AssignmentFormValues>({
    defaultValues: { driver_id: '' },
  });

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const openAssignment = useCallback((vehicle: MilkrunVehicle) => {
    reset({ driver_id: vehicle.driver_id ?? '' });
    setAssignmentTarget(vehicle);
  }, [reset]);

  const saveAssignment = async (values: AssignmentFormValues) => {
    if (!assignmentTarget) return;
    const ok = await resource.runMutation(
      () => updateMilkrunVehicle(assignmentTarget.id, { driver_id: values.driver_id || null }),
      'Đã cập nhật tài xế cho xe.',
      'Không thể gán hoặc đổi xe cho tài xế.',
    );
    if (ok) setAssignmentTarget(null);
  };

  const columns = useMemo<Column<MilkrunVehicle>[]>(() => [
    { header: 'Mã xe', accessor: 'code', sortKey: 'code' },
    { header: 'Biển số', accessor: 'plate_number', sortKey: 'plate_number' },
    { header: 'Tên xe', accessor: 'name', sortKey: 'name', render: (item) => item.name || '—' },
    {
      header: 'Tài xế',
      accessor: 'driver',
      render: (item) => item.driver
        ? `${item.driver.first_name} ${item.driver.last_name}${item.driver.is_active === false || item.driver.is_deleted ? ' (không hoạt động)' : ''}`
        : 'Chưa gán',
    },
    { header: 'Trạng thái', accessor: 'is_active', sortKey: 'is_active', render: (item) => <StatusBadge active={item.is_active} /> },
    { header: 'Cập nhật', accessor: 'updated_at', sortKey: 'updated_at', render: (item) => formatDate(item.updated_at) },
    ...(canOpenAssignment ? [{
      header: 'Thao tác',
      accessor: 'actions',
      render: (item: MilkrunVehicle) => <RowActions onEdit={() => openAssignment(item)} />,
    }] : []),
  ], [canOpenAssignment, openAssignment]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title="Xe Milkrun"
        description="Theo dõi xe và gán một tài xế cho tối đa một xe tại cùng thời điểm."
      />
      <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
      {canAssign && !canReadUsers && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bạn có quyền gán xe nhưng không có quyền đọc danh sách User. Chức năng chọn tài xế được ẩn cho đến khi có permission lookup tài xế chính thức hoặc quyền admin.user.read.
        </div>
      )}
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(item) => item.id}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Tìm mã xe, biển số hoặc tên xe..."
          renderTopToolbar={() => (
            <select
              value={String(resource.query.isActive ?? true)}
              onChange={(event) => resource.updateQuery({ isActive: event.target.value === 'true' })}
              className={inputClassName}
              aria-label="Lọc trạng thái xe"
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
          emptyText="Không có xe phù hợp."
        />
      )}
      {assignmentTarget && canOpenAssignment && (
        <CrudModal title={`Gán tài xế — ${assignmentTarget.code}`} busy={resource.mutating} onClose={() => setAssignmentTarget(null)}>
          <form onSubmit={handleSubmit(saveAssignment)}>
            <label className={labelClassName}>
              Tài xế
              <select {...register('driver_id')} className={inputClassName} disabled={usersQuery.isPending || usersQuery.isError}>
                <option value="">Chưa gán</option>
                {(usersQuery.data?.data ?? [])
                  .filter((user) => user.is_verified && user.is_active && !user.is_deleted)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} — {user.vinfast_id}
                    </option>
                  ))}
              </select>
            </label>
            {usersQuery.isError && <p role="alert" className="mt-2 text-sm text-rose-600">Không thể tải danh sách tài xế.</p>}
            <FormActions busy={resource.mutating} onCancel={() => setAssignmentTarget(null)} submitLabel="Lưu phân công" />
          </form>
        </CrudModal>
      )}
    </section>
  );
};

export default VehiclesPage;
