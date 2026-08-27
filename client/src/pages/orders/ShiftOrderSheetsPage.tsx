import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listShiftOrderSheets } from '../../api/shift-order-sheets.service';
import { getWorkShifts } from '../../api/work-shifts.service';
import { DataTable, type Column } from '../../components/common/DataTable';
import { TextButton } from '../../components/common/Button';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useCrudResource } from '../../hooks/useCrudResource';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { ShiftOrderSheetListParams, ShiftOrderSheetSummary } from '../../types/shift-order-sheets';
import type { PaginationParams } from '../../types/pagination.types';
import type { WorkShift } from '../../types/work-shifts';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const controlClassName = 'rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
type ShiftOrderSheetQuery = ShiftOrderSheetListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: BUSINESS_TIME_ZONE,
}).format(new Date(`${value}T00:00:00+07:00`));

const userName = (sheet: ShiftOrderSheetSummary) => sheet.leader
  ? `${sheet.leader.first_name} ${sheet.leader.last_name}`.trim()
  : 'Không xác định';

const ShiftOrderSheetsPage = () => {
  const { role } = useAuth();
  const basePath = getWorkspacePath(role, 'shift-order-sheets');
  const loader = useCallback(
    (query: ShiftOrderSheetQuery, signal: AbortSignal) => listShiftOrderSheets(query, signal),
    [],
  );
  const resource = usePaginatedResource<ShiftOrderSheetSummary, ShiftOrderSheetQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'work_date', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải danh sách Phiếu Order Ca.',
    queryKey: queryKeys.shiftOrderSheets.lists,
  });
  const { query, updateQuery } = resource;
  const shifts = useCrudResource<WorkShift>(
    (signal) => getWorkShifts(signal),
    'Không thể tải danh mục ca.',
    queryKeys.workShifts.lookups,
  );
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== query.search) updateQuery({ search });
  }, [debouncedSearch, query.search, updateQuery]);

  const leaderOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const sheet of resource.items) map.set(sheet.leader_id, userName(sheet));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [resource.items]);

  const columns = useMemo<Column<ShiftOrderSheetSummary>[]>(() => [
    {
      header: 'Ngày làm việc',
      accessor: 'work_date',
      sortKey: 'work_date',
      render: (sheet) => <span className="font-semibold text-slate-900">{formatDate(sheet.work_date)}</span>,
    },
    { header: 'Ca', accessor: 'work_shift_id', render: (sheet) => sheet.work_shift ? `${sheet.work_shift.code} — ${sheet.work_shift.name}` : '—' },
    { header: 'Area', accessor: 'area_id', render: (sheet) => sheet.area ? `${sheet.area.code} — ${sheet.area.name}` : '—' },
    { header: 'Tổ trưởng', accessor: 'leader_id', render: userName },
    { header: 'Orders', accessor: 'order_count', render: (sheet) => sheet.order_count },
    { header: 'Thao tác', accessor: 'id', render: (sheet) => <Link to={`${basePath}/${sheet.id}`} className={TextButton}>Xem phiếu</Link> },
  ], [basePath]);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Quản lý giao dịch</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Phiếu Order Ca</h1>
        <p className="mt-1 text-sm text-slate-500">Tổng hợp Order theo Area, ca được gán và ngày làm việc tại Asia/Ho_Chi_Minh.</p>
      </div>

      <DataTable
        columns={columns}
        data={resource.items}
        keyExtractor={(sheet) => sheet.id}
        loading={resource.loading}
        loadingText="Đang tải Phiếu Order Ca"
        emptyText={resource.error ?? 'Không có Phiếu Order Ca phù hợp.'}
        searchPlaceholder="Tìm Phiếu Order Ca"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        renderTopToolbar={() => (
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={query.workDate ?? ''}
              onChange={(event) => updateQuery({ workDate: event.target.value || undefined })}
              className={controlClassName}
              aria-label="Ngày làm việc"
            />
            <select
              value={query.workShiftId ?? ''}
              onChange={(event) => updateQuery({ workShiftId: event.target.value || undefined })}
              className={controlClassName}
              aria-label="Ca làm việc"
              disabled={shifts.loading || Boolean(shifts.error)}
            >
              <option value="">Tất cả ca</option>
              {shifts.items.map((shift) => <option key={shift.id} value={shift.id}>{shift.code} — {shift.name}</option>)}
            </select>
            <select
              value={query.leaderId ?? ''}
              onChange={(event) => updateQuery({ leaderId: event.target.value || undefined })}
              className={controlClassName}
              aria-label="Tổ trưởng"
            >
              <option value="">Tất cả tổ trưởng trên trang</option>
              {leaderOptions.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
            </select>
          </div>
        )}
        pagination={resource.pagination}
        onPageChange={resource.setPage}
        onPageSizeChange={resource.setPageSize}
        sortBy={query.sortBy}
        sortOrder={query.sortOrder}
        onSortChange={(sortBy, sortOrder) => updateQuery({ sortBy, sortOrder })}
      />
      {resource.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{resource.error}</div>}
    </section>
  );
};

export default ShiftOrderSheetsPage;
