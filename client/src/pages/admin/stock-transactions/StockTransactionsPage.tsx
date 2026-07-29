import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../api/errors';
import { listAreas } from '../../../api/areas.service';
import { listStorageLocations } from '../../../api/storage-locations.service';
import { createStockAdjustment, getStockTransaction, listStockTransactions } from '../../../api/stock-transactions.service';
import { listSupplies } from '../../../api/supplies.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import { CrudFeedbackToast, CrudModal, CrudPageHeader, ErrorState, inputClassName } from '../../../components/admin/crud/CrudPrimitives';
import { StockAdjustmentModal } from '../../../components/admin/stock/StockAdjustmentModal';
import { CardSkeleton, SelectSkeleton } from '../../../components/common/skeleton';
import { STOCK_MUTATOR_ROLES } from '../../../constants/roles';
import { useAuth } from '../../../context/AuthContext';
import { useCrudResource } from '../../../hooks/useCrudResource';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import { useServerLookup } from '../../../hooks/useServerLookup';
import { queryKeys } from '../../../lib/queryKeys';
import type { PaginationParams } from '../../../types/pagination.types';
import type { CreateStockAdjustmentInput, StockTransaction, StockTransactionListParams, StockTransactionType } from '../../../types/stock-transactions';
import { STOCK_TRANSACTION_TYPES } from '../../../types/stock-transactions';

type StockTransactionQuery = StockTransactionListParams & PaginationParams;

const loadAreas = async (signal: AbortSignal) =>
  (await listAreas(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const transactionTypeClass = (type: StockTransactionType) => type.endsWith('_IN') || type === 'RECEIVE' || type === 'IMPORT' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
const transactionTypeCode = (transaction: StockTransaction) =>
  (transaction.transaction_type?.code ?? 'UNKNOWN') as StockTransactionType;

const StockTransactionsPage = () => {
  const { role } = useAuth();
  const canAdjust = role !== null && STOCK_MUTATOR_ROLES.includes(role);
  const loader = useCallback((query: StockTransactionQuery, signal: AbortSignal) => listStockTransactions(query, signal), []);
  const resource = usePaginatedResource<StockTransaction, StockTransactionQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải stock transactions.',
    queryKey: queryKeys.stockTransactions.lists,
    invalidateQueryKeys: [queryKeys.stockBalances.all],
  });
  const areas = useCrudResource(
    loadAreas,
    'Không thể tải danh sách khu vực.',
    queryKeys.areas.lookup({ pageSize: 100, isActive: true }),
  );
  const supplyLoader = useCallback((search: string | undefined, signal: AbortSignal) => listSupplies({ page: 1, pageSize: 20, search, isActive: true, isDeleted: false, sortBy: 'code', sortOrder: 'asc' }, signal), []);
  const locationLoader = useCallback((search: string | undefined, signal: AbortSignal) => listStorageLocations({ page: 1, pageSize: 20, search, areaId: resource.query.areaId, isActive: true, sortBy: 'code', sortOrder: 'asc' }, signal), [resource.query.areaId]);
  const supplies = useServerLookup({
    loader: supplyLoader,
    queryKey: (search) => queryKeys.supplies.lookup({ search, pageSize: 20, isActive: true, isDeleted: false }),
    errorMessage: 'Không thể tải danh sách vật tư.',
  });
  const locations = useServerLookup({
    loader: locationLoader,
    queryKey: (search) => queryKeys.storageLocations.lookup({ search, areaId: resource.query.areaId, pageSize: 20, isActive: true }),
    errorMessage: 'Không thể tải danh sách vị trí kho.',
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: queryKeys.stockTransactions.detail(detailId ?? ''),
    queryFn: ({ signal }) => getStockTransaction(detailId!, signal),
    enabled: detailOpen && Boolean(detailId),
  });
  const detail = detailQuery.data ?? null;
  const detailLoading = detailQuery.isPending;
  const detailError = detailQuery.isError
    ? getApiErrorMessage(detailQuery.error, 'Không thể tải chi tiết transaction.')
    : null;

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const openDetail = (id: string) => {
    setDetailOpen(true);
    setDetailId(id);
  };

  const columns: Column<StockTransaction>[] = [
    { header: 'Loại', accessor: 'transaction_type_id', sortKey: 'type', render: (item) => {
      const type = transactionTypeCode(item);
      return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${transactionTypeClass(type)}`}>{type}</span>;
    } },
    { header: 'Vật tư', accessor: 'supply_id', render: (item) => item.supply ? <div><p className="font-semibold text-slate-800">{item.supply.code}</p><p className="text-xs text-slate-500">{item.supply.description || '—'}</p></div> : '—' },
    { header: 'Khu vực / Vị trí', accessor: 'area_id', render: (item) => <div><p>{item.area ? `${item.area.code} - ${item.area.name}` : '—'}</p><p className="text-xs text-slate-500">{item.storage_location?.code ?? '—'}</p></div> },
    { header: 'Số lượng', accessor: 'quantity', sortKey: 'quantity', render: (item) => numberFormatter.format(item.quantity) },
    { header: 'Trước → Sau', accessor: 'before_quantity', render: (item) => `${numberFormatter.format(item.before_quantity)} → ${numberFormatter.format(item.after_quantity)}` },
    { header: 'Lý do', accessor: 'reason', render: (item) => item.reason || '—' },
    { header: 'Người tạo', accessor: 'created_by', render: (item) => item.creator ? `${item.creator.first_name} ${item.creator.last_name}`.trim() : item.created_by },
    { header: 'Thời gian', accessor: 'created_at', sortKey: 'created_at', render: (item) => dateFormatter.format(new Date(item.created_at)) },
    { header: 'Chi tiết', accessor: 'detail', render: (item) => <button type="button" onClick={() => void openDetail(item.id)} className="font-semibold text-blue-600 hover:text-blue-800">Xem</button> },
  ];

  const createAdjustment = (input: CreateStockAdjustmentInput) => resource.runMutation(() => createStockAdjustment(input), 'Đã tạo stock adjustment và transaction audit.', 'Không thể tạo stock adjustment.');

  return <div className="space-y-6">
    <CrudPageHeader title="Stock transactions" description="Audit log bất biến của mọi biến động tồn kho." createLabel="Tạo adjustment" onCreate={canAdjust ? () => setAdjustmentOpen(true) : undefined} />
    <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1">
        <input type="search" value={supplies.search} onChange={(event) => supplies.setSearch(event.target.value)} placeholder="Tìm vật tư trên server..." className={inputClassName} />
        {supplies.loading && supplies.items.length === 0 ? <SelectSkeleton label="Đang tải bộ lọc vật tư" /> : <select value={resource.query.supplyId ?? ''} onChange={(event) => resource.updateQuery({ supplyId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả vật tư</option>{supplies.items.map((supply) => <option key={supply.id} value={supply.id}>{supply.code}</option>)}</select>}
      </div>
      {areas.loading && areas.items.length === 0 ? <SelectSkeleton label="Đang tải bộ lọc khu vực" /> : <select value={resource.query.areaId ?? ''} onChange={(event) => resource.updateQuery({ areaId: event.target.value || undefined, storageLocationId: undefined })} className={inputClassName}><option value="">Tất cả khu vực</option>{areas.items.map((area) => <option key={area.id} value={area.id}>{area.code} - {area.name}</option>)}</select>}
      <div className="space-y-1">
        <input type="search" value={locations.search} onChange={(event) => locations.setSearch(event.target.value)} placeholder="Tìm vị trí kho trên server..." className={inputClassName} />
        {locations.loading && locations.items.length === 0 ? <SelectSkeleton label="Đang tải bộ lọc vị trí kho" /> : <select value={resource.query.storageLocationId ?? ''} onChange={(event) => resource.updateQuery({ storageLocationId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả vị trí kho</option>{locations.items.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}</select>}
      </div>
      <select value={resource.query.type ?? ''} onChange={(event) => resource.updateQuery({ type: (event.target.value || undefined) as StockTransactionType | undefined })} className={inputClassName}><option value="">Tất cả transaction type</option>{STOCK_TRANSACTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <input type="text" value={resource.query.createdBy ?? ''} onChange={(event) => resource.updateQuery({ createdBy: event.target.value.trim() || undefined })} placeholder="Created by UUID" className={inputClassName} />
      <input type="date" value={resource.query.dateFrom ?? ''} onChange={(event) => resource.updateQuery({ dateFrom: event.target.value || undefined })} className={inputClassName} aria-label="Từ ngày" />
      <input type="date" value={resource.query.dateTo ?? ''} onChange={(event) => resource.updateQuery({ dateTo: event.target.value || undefined })} className={inputClassName} aria-label="Đến ngày" />
    </div>
    {[supplies.error, areas.error, locations.error].some(Boolean) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Một số bộ lọc không tải được. Danh sách transaction vẫn được hiển thị nếu API chính hoạt động.</p>}
    {resource.error ? <ErrorState message={resource.error} onRetry={resource.reload} /> : <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id} searchPlaceholder="Tìm transaction, vật tư, lý do..." searchValue={searchInput} onSearchChange={setSearchInput} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có transaction phù hợp với bộ lọc." />}
    {detailOpen && <CrudModal title="Chi tiết stock transaction" onClose={() => setDetailOpen(false)}>{detailLoading ? <CardSkeleton lines={6} label="Đang tải chi tiết transaction" /> : detailError ? <ErrorState message={detailError} onRetry={() => void detailQuery.refetch()} /> : detail ? <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{[['Type', transactionTypeCode(detail)], ['Vật tư', detail.supply ? `${detail.supply.code}${detail.supply.description ? ` - ${detail.supply.description}` : ''}` : detail.supply_id], ['Khu vực', detail.area ? `${detail.area.code} - ${detail.area.name}` : detail.area_id], ['Vị trí kho', detail.storage_location ? `${detail.storage_location.code}${detail.storage_location.name ? ` - ${detail.storage_location.name}` : ''}` : detail.storage_location_id], ['Số lượng', numberFormatter.format(detail.quantity)], ['Tồn trước', numberFormatter.format(detail.before_quantity)], ['Tồn sau', numberFormatter.format(detail.after_quantity)], ['Lý do', detail.reason || '—'], ['Ghi chú', detail.note || '—'], ['Người tạo', detail.creator ? `${detail.creator.first_name} ${detail.creator.last_name}`.trim() : detail.created_by], ['Thời gian', dateFormatter.format(new Date(detail.created_at))], ['Order ID', detail.order_id || '—']].map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value}</dd></div>)}</dl> : null}</CrudModal>}
    {adjustmentOpen && canAdjust && <StockAdjustmentModal busy={resource.mutating} onClose={() => setAdjustmentOpen(false)} onSubmit={createAdjustment} />}
  </div>;
};

export default StockTransactionsPage;
