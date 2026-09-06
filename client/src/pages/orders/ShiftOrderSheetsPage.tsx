import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../api/errors';
import {
  getCurrentShiftOrderSheet,
  getShiftOrderSheet,
  listShiftOrderSheets,
} from '../../api/shift-order-sheets.service';
import { DataTable, type Column } from '../../components/common/DataTable';
import { SecondaryButton, TextButton } from '../../components/common/Button';
import { CardSkeleton } from '../../components/common/skeleton';
import { ShiftOrderSheetWorkspace } from '../../components/orders/ShiftOrderSheetWorkspace';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { queryKeys } from '../../lib/queryKeys';
import type {
  ShiftOrderSheetListParams,
  ShiftOrderSheetSummary,
} from '../../types/shift-order-sheets';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const controlClassName = 'rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const formatDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: BUSINESS_TIME_ZONE,
}).format(new Date(`${value}T00:00:00+07:00`));

const ShiftOrderSheetsPage = () => {
  const { user } = useAuth();
  const areaId = user?.publicData.area_id ?? '';
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historySearch, setHistorySearch] = useState('');
  const [historyWorkDate, setHistoryWorkDate] = useState('');
  const debouncedHistorySearch = useDebounce(historySearch);

  const currentQuery = useQuery({
    queryKey: queryKeys.shiftOrderSheets.current,
    queryFn: ({ signal }) => getCurrentShiftOrderSheet(signal),
    enabled: Boolean(areaId),
  });

  const historyParams = useMemo<ShiftOrderSheetListParams>(() => ({
    page: historyPage,
    pageSize: historyPageSize,
    search: debouncedHistorySearch.trim() || undefined,
    workDate: historyWorkDate || undefined,
    sortBy: 'work_date',
    sortOrder: 'desc',
  }), [debouncedHistorySearch, historyPage, historyPageSize, historyWorkDate]);

  const historyQuery = useQuery({
    queryKey: queryKeys.shiftOrderSheets.history({ ...historyParams }),
    queryFn: ({ signal }) => listShiftOrderSheets(historyParams, signal),
    enabled: historyOpen,
    placeholderData: (previous) => previous,
  });

  const selectedHistoryQuery = useQuery({
    queryKey: queryKeys.shiftOrderSheets.detail(selectedHistoryId ?? ''),
    queryFn: ({ signal }) => getShiftOrderSheet(selectedHistoryId!, signal),
    enabled: Boolean(selectedHistoryId),
  });

  const historyColumns = useMemo<Column<ShiftOrderSheetSummary>[]>(() => [
    {
      header: 'Ngày',
      accessor: 'work_date',
      render: (sheet) => <span className="font-semibold text-slate-900">{formatDate(sheet.work_date)}</span>,
    },
    {
      header: 'Ca',
      accessor: 'work_shift_id',
      render: (sheet) => sheet.work_shift ? `${sheet.work_shift.code} — ${sheet.work_shift.name}` : '—',
    },
    {
      header: 'Khu vực',
      accessor: 'area_id',
      render: (sheet) => sheet.area ? `${sheet.area.code} — ${sheet.area.name}` : '—',
    },
    { header: 'Số Order', accessor: 'order_count', render: (sheet) => sheet.order_count },
    { header: 'Số mã', accessor: 'item_count', render: (sheet) => sheet.item_count },
    {
      header: 'Thao tác',
      accessor: 'id',
      render: (sheet) => (
        <button type="button" className={TextButton} onClick={() => setSelectedHistoryId(sheet.id)}>
          Xem lịch sử
        </button>
      ),
    },
  ], []);

  if (!areaId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Phiếu order ca</h1>
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <p className="font-semibold">Bạn chưa được gán khu vực làm việc.</p>
          <p className="mt-1 text-sm">Vui lòng liên hệ quản trị viên để cập nhật Area cho tài khoản.</p>
        </div>
      </section>
    );
  }

  if (!historyOpen) {
    if (currentQuery.isPending) {
      return <CardSkeleton lines={9} label="Đang tải Phiếu Order Ca hiện tại" />;
    }
    if (currentQuery.isError || !currentQuery.data) {
      return (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Phiếu order ca</h1>
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            {getApiErrorMessage(currentQuery.error, 'Không thể xác định Phiếu Order Ca hiện tại.')}
          </div>
          <button type="button" className={SecondaryButton} onClick={() => setHistoryOpen(true)}>
            Lịch sử phiếu order ca
          </button>
        </section>
      );
    }

    const { context, sheet } = currentQuery.data;
    return (
      <ShiftOrderSheetWorkspace
        mode="current"
        sheet={sheet}
        context={{
          id: sheet?.id ?? null,
          area_id: context.area_id,
          work_shift_id: context.work_shift_id,
          work_date: context.work_date,
          area: context.area,
          work_shift: context.work_shift,
          leader: sheet?.leader ?? null,
        }}
        onShowHistory={() => {
          setSelectedHistoryId(null);
          setHistoryOpen(true);
        }}
      />
    );
  }

  if (selectedHistoryId) {
    if (selectedHistoryQuery.isPending) {
      return <CardSkeleton lines={9} label="Đang tải lịch sử Phiếu Order Ca" />;
    }
    if (selectedHistoryQuery.isError || !selectedHistoryQuery.data) {
      return (
        <section className="space-y-4">
          <button type="button" className={SecondaryButton} onClick={() => setSelectedHistoryId(null)}>
            ← Quay lại lịch sử
          </button>
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
            {getApiErrorMessage(selectedHistoryQuery.error, 'Không thể tải Phiếu Order Ca lịch sử.')}
          </div>
        </section>
      );
    }

    const sheet = selectedHistoryQuery.data;
    if (!sheet.area || !sheet.work_shift) {
      return (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          Phiếu Order Ca lịch sử thiếu Area hoặc ca làm việc hợp lệ.
        </div>
      );
    }
    return (
      <ShiftOrderSheetWorkspace
        mode="history"
        sheet={sheet}
        context={{
          id: sheet.id,
          area_id: sheet.area_id,
          work_shift_id: sheet.work_shift_id,
          work_date: sheet.work_date,
          area: sheet.area,
          work_shift: sheet.work_shift,
          leader: sheet.leader,
        }}
        onBackCurrent={() => {
          setSelectedHistoryId(null);
          setHistoryOpen(false);
        }}
      />
    );
  }

  const history = historyQuery.data;
  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Lịch sử</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Lịch sử Phiếu order ca</h1>
          <p className="mt-1 text-sm text-slate-500">Các phiếu được backend giới hạn theo phạm vi Area được phép đọc.</p>
        </div>
        <button
          type="button"
          className={SecondaryButton}
          onClick={() => {
            setSelectedHistoryId(null);
            setHistoryOpen(false);
          }}
        >
          ← Quay lại phiếu hiện tại
        </button>
      </header>

      <DataTable
        columns={historyColumns}
        data={history?.data ?? []}
        keyExtractor={(sheet) => sheet.id}
        loading={historyQuery.isPending || historyQuery.isFetching}
        loadingText="Đang tải lịch sử Phiếu Order Ca"
        emptyText={historyQuery.isError
          ? getApiErrorMessage(historyQuery.error, 'Không thể tải lịch sử Phiếu Order Ca.')
          : 'Chưa có Phiếu Order Ca trong lịch sử.'}
        searchPlaceholder="Tìm theo Area, ca, tổ trưởng hoặc ngày"
        searchValue={historySearch}
        onSearchChange={(value) => {
          setHistorySearch(value);
          setHistoryPage(1);
        }}
        renderTopToolbar={() => (
          <input
            type="date"
            value={historyWorkDate}
            onChange={(event) => {
              setHistoryWorkDate(event.target.value);
              setHistoryPage(1);
            }}
            className={controlClassName}
            aria-label="Lọc ngày làm việc"
          />
        )}
        pagination={history?.pagination}
        onPageChange={setHistoryPage}
        onPageSizeChange={(pageSize) => {
          setHistoryPageSize(pageSize);
          setHistoryPage(1);
        }}
        sortBy="work_date"
        sortOrder="desc"
        onSortChange={() => undefined}
      />
    </section>
  );
};

export default ShiftOrderSheetsPage;
