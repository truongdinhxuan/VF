import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listMilkrunTrips, listMilkrunTripStatuses } from '../../api/milkrun-trips.service';
import { InfoButton, TextButton } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { PERMISSION_CODE } from '../../constants/permissions';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunTrip, MilkrunTripListParams } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type TripQuery = MilkrunTripListParams & PaginationParams;

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

const TripsListPage = ({ scope = 'all' }: { scope?: 'all' | 'own' }) => {
  const { user, role, hasPermission } = useAuth();
  const tripsPath = getWorkspacePath(role, 'milkrun/trips');
  const createPath = getWorkspacePath(role, 'milkrun/trips/create');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);
  const loader = useCallback(
    (query: TripQuery, signal: AbortSignal) => listMilkrunTrips(query, signal),
    [],
  );
  const resource = usePaginatedResource<MilkrunTrip, TripQuery>({
    loader,
    initialQuery: {
      page: 1,
      pageSize: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
      ...(scope === 'own' ? { driverId: user?.publicData.id } : {}),
    },
    loadErrorMessage: 'Không thể tải danh sách Milkrun Trip.',
    queryKey: queryKeys.milkrunTrips.lists,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const statusLookup = useQuery({
    queryKey: queryKeys.milkrunTripStatuses.lookup({ pageSize: 100 }),
    queryFn: ({ signal }) => listMilkrunTripStatuses(
      { page: 1, pageSize: 100, isActive: true, isDeleted: false },
      signal,
    ),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const columns = useMemo<Column<MilkrunTrip>[]>(() => [
    {
      header: 'Mã Trip',
      accessor: 'code',
      sortKey: 'code',
      render: (trip) => <Link to={`${tripsPath}/${trip.id}`} className={TextButton}>{trip.code}</Link>,
    },
    { header: 'Trạng thái', accessor: 'status', render: (trip) => trip.status?.name ?? trip.status_id },
    { header: 'Shop', accessor: 'shop', render: (trip) => trip.shop ? `${trip.shop.code} — ${trip.shop.name}` : trip.shop_id },
    { header: 'Loại Trip', accessor: 'trip_type', render: (trip) => trip.trip_type?.name ?? trip.trip_type_id },
    {
      header: 'Driver',
      accessor: 'driver',
      render: (trip) => trip.driver
        ? `${trip.driver.first_name} ${trip.driver.last_name} (${trip.driver.vinfast_id})${trip.driver.is_active === false || trip.driver.is_deleted ? ' — không hoạt động' : ''}`
        : 'Không tìm thấy tài xế',
    },
    { header: 'Ngày tạo', accessor: 'created_at', sortKey: 'created_at', render: (trip) => formatDate(trip.created_at) },
  ], [tripsPath]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Milkrun</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {scope === 'own' ? 'Chuyến đi của tôi' : 'Tất cả chuyến đi'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {scope === 'own'
              ? 'Danh sách được giới hạn theo tài khoản tài xế hiện tại.'
              : 'Danh sách vận hành dành cho người có quyền xem tất cả chuyến.'}
          </p>
        </div>
        {hasPermission(PERMISSION_CODE.MILKRUN_TRIP_CREATE) && (
          <Link to={createPath} className={InfoButton}>Tạo Trip</Link>
        )}
      </div>

      {statusLookup.isError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Không thể tải trạng thái Trip.
        </div>
      )}
      {resource.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {resource.error}
          <button type="button" onClick={resource.reload} className={`${TextButton} ml-2`}>Thử lại</button>
        </div>
      )}

      {!resource.error && (
        <DataTable
          columns={columns}
          data={resource.items}
          keyExtractor={(trip) => trip.id}
          loading={resource.loading}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Tìm mã Trip hoặc ghi chú..."
          emptyText="Không có Trip phù hợp."
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          renderTopToolbar={() => (
            <select
              value={resource.query.status ?? ''}
              onChange={(event) => resource.updateQuery({ status: event.target.value || undefined })}
              disabled={statusLookup.isPending || statusLookup.isError}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              aria-label="Lọc theo trạng thái Trip"
            >
              <option value="">Tất cả trạng thái</option>
              {(statusLookup.data?.data ?? []).map((status) => (
                <option key={status.id} value={status.code}>{status.code} — {status.name}</option>
              ))}
            </select>
          )}
        />
      )}
    </section>
  );
};

export default TripsListPage;
