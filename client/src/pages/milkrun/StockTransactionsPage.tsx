import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  listMilkrunRacks,
  listMilkrunStockTransactionTypes,
} from '../../api/milkrun-master-data.service';
import { listMilkrunStockTransactions } from '../../api/milkrun-stock.service';
import { SecondaryButton, TextButton } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { CrudPageHeader, ErrorState, inputClassName } from '../../components/crud/CrudPrimitives';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunStockTransaction, MilkrunStockTransactionListParams } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type StockTransactionQuery = MilkrunStockTransactionListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const transactionSource = (item: MilkrunStockTransaction) => {
  if (item.trip_id) return 'TRIP';
  if (item.transaction_type?.code.startsWith('REVERSAL_')) return 'REVERSAL';
  return 'MANUAL_ADJUSTMENT';
};

const StockTransactionsPage = () => {
  const { role } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [tripIdInput, setTripIdInput] = useState('');
  const [createdByInput, setCreatedByInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const loader = useCallback(
    (query: StockTransactionQuery, signal: AbortSignal) =>
      listMilkrunStockTransactions(query, signal),
    [],
  );
  const resource = usePaginatedResource<MilkrunStockTransaction, StockTransactionQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải lịch sử giao dịch Rack.',
    queryKey: queryKeys.milkrunStockTransactions.lists,
  });
  const racksQuery = useQuery({
    queryKey: queryKeys.milkrunRacks.lookup({ pageSize: 100, active: true }),
    queryFn: ({ signal }) => listMilkrunRacks(
      { page: 1, pageSize: 100, isActive: true, isDeleted: false },
      signal,
    ),
    staleTime: 5 * 60 * 1000,
  });
  const typesQuery = useQuery({
    queryKey: queryKeys.milkrunStockTransactionTypes.lookup({ pageSize: 100, active: true }),
    queryFn: ({ signal }) => listMilkrunStockTransactionTypes(
      { page: 1, pageSize: 100, isActive: true, isDeleted: false },
      signal,
    ),
    staleTime: 5 * 60 * 1000,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const columns = useMemo<Column<MilkrunStockTransaction>[]>(() => [
    { header: 'Thời gian', accessor: 'created_at', sortKey: 'created_at', render: (item) => formatDate(item.created_at) },
    { header: 'Mã GD', accessor: 'id', render: (item) => <span title={item.id}>{item.id.slice(0, 8)}</span> },
    { header: 'Rack', accessor: 'rack', render: (item) => item.rack ? `${item.rack.code} — ${item.rack.name}` : item.rack_id },
    { header: 'Loại', accessor: 'transaction_type', render: (item) => item.transaction_type ? `${item.transaction_type.code} — ${item.transaction_type.name}` : item.transaction_type_id },
    { header: 'Số lượng', accessor: 'quantity', sortKey: 'quantity', render: (item) => Number(item.quantity).toLocaleString('vi-VN') },
    { header: 'Tồn trước', accessor: 'before_quantity', sortKey: 'before_quantity', render: (item) => Number(item.before_quantity).toLocaleString('vi-VN') },
    { header: 'Tồn sau', accessor: 'after_quantity', sortKey: 'after_quantity', render: (item) => Number(item.after_quantity).toLocaleString('vi-VN') },
    { header: 'Nguồn', accessor: 'source', render: transactionSource },
    {
      header: 'Trip',
      accessor: 'trip_id',
      render: (item) => item.trip_id
        ? <Link to={getWorkspacePath(role, `milkrun/trips/${item.trip_id}`)} className={TextButton}>Xem Trip</Link>
        : '—',
    },
    {
      header: 'Người thực hiện',
      accessor: 'creator',
      render: (item) => item.creator
        ? `${item.creator.first_name} ${item.creator.last_name}`
        : item.created_by ?? '—',
    },
    { header: 'Lý do', accessor: 'adjustment_reason', render: (item) => item.adjustment_reason ? `${item.adjustment_reason.code} — ${item.adjustment_reason.name}` : '—' },
    { header: 'Ghi chú', accessor: 'reason_note', render: (item) => item.reason_note || '—' },
  ], [role]);

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title="Giao dịch Rack"
        description="Audit log tồn Rack bất biến; không hỗ trợ sửa hoặc xóa giao dịch cũ."
      />
      {(racksQuery.isError || typesQuery.isError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Không thể tải một số danh mục lọc. Danh sách giao dịch vẫn có thể được xem.
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
          searchPlaceholder="Tìm trong ghi chú lý do..."
          renderTopToolbar={() => (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <select
                value={resource.query.rackId ?? ''}
                onChange={(event) => resource.updateQuery({ rackId: event.target.value || undefined })}
                className={inputClassName}
                aria-label="Lọc Rack"
              >
                <option value="">Tất cả Rack</option>
                {(racksQuery.data?.data ?? []).map((rack) => <option key={rack.id} value={rack.id}>{rack.code} — {rack.name}</option>)}
              </select>
              <select
                value={resource.query.transactionTypeId ?? ''}
                onChange={(event) => resource.updateQuery({ transactionTypeId: event.target.value || undefined })}
                className={inputClassName}
                aria-label="Lọc loại giao dịch"
              >
                <option value="">Tất cả loại</option>
                {(typesQuery.data?.data ?? []).map((type) => <option key={type.id} value={type.id}>{type.code}</option>)}
              </select>
              <input
                type="datetime-local"
                value={resource.query.dateFrom?.slice(0, 16) ?? ''}
                onChange={(event) => resource.updateQuery({ dateFrom: event.target.value ? new Date(event.target.value).toISOString() : undefined })}
                className={inputClassName}
                aria-label="Từ ngày"
              />
              <input
                type="datetime-local"
                value={resource.query.dateTo?.slice(0, 16) ?? ''}
                onChange={(event) => resource.updateQuery({ dateTo: event.target.value ? new Date(event.target.value).toISOString() : undefined })}
                className={inputClassName}
                aria-label="Đến ngày"
              />
              <input
                value={tripIdInput}
                onChange={(event) => setTripIdInput(event.target.value)}
                className={inputClassName}
                placeholder="Trip UUID"
                aria-label="Lọc theo Trip ID"
              />
              <input
                value={createdByInput}
                onChange={(event) => setCreatedByInput(event.target.value)}
                className={inputClassName}
                placeholder="User UUID"
                aria-label="Lọc theo người thực hiện"
              />
              <button
                type="button"
                className={SecondaryButton}
                onClick={() => resource.updateQuery({
                  tripId: tripIdInput.trim() || undefined,
                  createdBy: createdByInput.trim() || undefined,
                })}
              >
                Áp dụng ID
              </button>
            </div>
          )}
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Chưa có giao dịch Rack phù hợp."
        />
      )}
    </section>
  );
};

export default StockTransactionsPage;
