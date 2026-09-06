import { useQuery } from '@tanstack/react-query';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { listMilkrunVehicles,updateMilkrunVehicle } from '../../api/milkrun-master-data.service';
import { getUsers } from '../../api/users.service';
import { DataTable,type Column } from '../../components/common/DataTable';
import { CrudEntityView } from '../../components/crud/CrudEntityView';
import {
CrudFeedbackToast,
CrudPageHeader,
ErrorState,
RowActions,
StatusBadge,
inputClassName
} from '../../components/crud/CrudPrimitives';
import { PrimaryCrudDrawer } from '../../components/crud/PrimaryCrudDrawer';
import { VehicleAssignmentForm,type AssignmentFormValues } from '../../components/forms/VehicleAssignmentForm';
import { PERMISSION_CODE } from '../../constants/permissions';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunLookupListParams,MilkrunVehicle } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type VehicleQuery = MilkrunLookupListParams & PaginationParams;


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
  const [formError, setFormError] = useState<string | null>(null);
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
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const openAssignment = useCallback((vehicle: MilkrunVehicle) => {
    setFormError(null);
    setViewing(false);
    setAssignmentTarget(vehicle);
  }, []);
  const openView = useCallback((vehicle: MilkrunVehicle) => {
    setFormError(null);
    setViewing(true); setAssignmentTarget(vehicle);
  }, []);

  const saveAssignment = async (values: AssignmentFormValues) => {
    if (!assignmentTarget) return;
    setFormError(null);
    try {
      const ok = await resource.runMutation(
        () => updateMilkrunVehicle(assignmentTarget.id, { driver_id: values.driver_id || null }),
        'Đã cập nhật tài xế cho xe.',
        'Không thể gán hoặc đổi xe cho tài xế.',
        { throwOnError: true },
      );
      if (ok) setAssignmentTarget(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu phân công.');
    }
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
    ...[{
      header: 'Thao tác',
      accessor: 'actions',
      render: (item: MilkrunVehicle) => <RowActions onView={() => openView(item)} onEdit={canOpenAssignment ? () => openAssignment(item) : undefined} />,
    }],
  ], [canOpenAssignment, openAssignment, openView]);

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
      {assignmentTarget && (viewing || canOpenAssignment) && (
        <PrimaryCrudDrawer mode={viewing ? 'view' : 'edit'} onEdit={viewing && canOpenAssignment ? () => setViewing(false) : undefined} error={formError} title={`${viewing ? 'Chi tiết xe' : 'Gán tài xế'} — ${assignmentTarget.code}`} busy={resource.mutating} onClose={() => setAssignmentTarget(null)}>
          {viewing ? <CrudEntityView fields={[
            { label: 'Mã xe', value: assignmentTarget.code },
            { label: 'Biển số', value: assignmentTarget.plate_number },
            { label: 'Tên xe', value: assignmentTarget.name },
            { label: 'Tài xế', value: assignmentTarget.driver ? `${assignmentTarget.driver.first_name} ${assignmentTarget.driver.last_name}` : 'Chưa gán' },
            { label: 'Trạng thái', value: <StatusBadge active={assignmentTarget.is_active} /> },
            { label: 'Cập nhật', value: formatDate(assignmentTarget.updated_at) },
          ]} /> : <VehicleAssignmentForm vehicle={assignmentTarget} users={usersQuery.data?.data ?? []} loading={usersQuery.isPending} failed={usersQuery.isError} busy={resource.mutating} onSave={saveAssignment} />}
        </PrimaryCrudDrawer>
      )}
    </section>
  );
};

export default VehiclesPage;
