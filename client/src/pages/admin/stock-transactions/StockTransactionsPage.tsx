import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../api/errors';
import { listAreas } from '../../../api/areas.service';
import { listStorageLocations } from '../../../api/storage-locations.service';
import { createStockAdjustment, getStockTransaction, listStockTransactions } from '../../../api/stock-transactions.service';
import { listSupplies } from '../../../api/supplies.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import { CrudFeedbackToast, CrudModal, CrudPageHeader, ErrorState, inputClassName, LoadingState } from '../../../components/admin/crud/CrudPrimitives';
import { StockAdjustmentModal } from '../../../components/admin/stock/StockAdjustmentModal';
import { STOCK_MUTATOR_ROLES } from '../../../constants/roles';
import { useAuth } from '../../../context/AuthContext';
import { useCrudResource } from '../../../hooks/useCrudResource';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import { useServerLookup } from '../../../hooks/useServerLookup';
import type { PaginationParams } from '../../../types/pagination.types';
import type { CreateStockAdjustmentInput, StockTransaction, StockTransactionListParams, StockTransactionType } from '../../../types/stock-transactions';
import { STOCK_TRANSACTION_TYPES } from '../../../types/stock-transactions';

type StockTransactionQuery = StockTransactionListParams & PaginationParams;

const loadAreas = async () => (await listAreas({ page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' })).data;
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const transactionTypeClass = (type: StockTransactionType) => type.endsWith('_IN') || type === 'RECEIVE' || type === 'IMPORT' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

const StockTransactionsPage = () => {
  const { role } = useAuth();
  const canAdjust = role !== null && STOCK_MUTATOR_ROLES.includes(role);
  const loader = useCallback((query: StockTransactionQuery, signal: AbortSignal) => listStockTransactions(query, signal), []);
  const resource = usePaginatedResource<StockTransaction, StockTransactionQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải stock transactions.',
  });
  const areas = useCrudResource(loadAreas, 'Không thể tải danh sách khu vực.');
  const supplyLoader = useCallback((search: string | undefined, signal: AbortSignal) => listSupplies({ page: 1, pageSize: 20, search, isActive: true, isDeleted: false, sortBy: 'code', sortOrder: 'asc' }, signal), []);
  const locationLoader = useCallback((search: string | undefined, signal: AbortSignal) => listStorageLocations({ page: 1, pageSize: 20, search, areaId: resource.query.areaId, isActive: true, sortBy: 'code', sortOrder: 'asc' }, signal), [resource.query.areaId]);
  const supplies = useServerLookup({ loader: supplyLoader, errorMessage: 'Không thể tải danh sách vật tư.' });
  const locations = useServerLookup({ loader: locationLoader, errorMessage: 'Không thể tải danh sách vị trí kho.' });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resource.query.search) resource.updateQuery({ search });
  }, [debouncedSearch, resource.query.search, resource.updateQuery]);

  const openDetail = async (id: string) => {
    setDetailOpen(true); setDetailId(id); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await getStockTransaction(id)); }
    catch (error) { setDetailError(getApiErrorMessage(error, 'Không thể tải chi tiết transaction.')); }
    finally { setDetailLoading(false); }
  };

  const columns: Column<StockTransaction>[] = [
    { header: 'Loại', accessor: 'type', sortKey: 'type', render: (item) => <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${transactionTypeClass(item.type)}`}>{item.type}</span> },
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
      <div className="space-y-1"><input type="search" value={supplies.search} onChange={(event) => supplies.setSearch(event.target.value)} placeholder="Tìm vật tư trên server..." className={inputClassName} /><select value={resource.query.supplyId ?? ''} onChange={(event) => resource.updateQuery({ supplyId: event.target.value || undefined })} className={inputClassName} disabled={supplies.loading}><option value="">{supplies.loading ? 'Đang tải vật tư...' : 'Tất cả vật tư'}</option>{supplies.items.map((supply) => <option key={supply.id} value={supply.id}>{supply.code}</option>)}</select></div>
      <select value={resource.query.areaId ?? ''} onChange={(event) => resource.updateQuery({ areaId: event.target.value || undefined, storageLocationId: undefined })} className={inputClassName} disabled={areas.loading}><option value="">{areas.loading ? 'Đang tải khu vực...' : 'Tất cả khu vực'}</option>{areas.items.map((area) => <option key={area.id} value={area.id}>{area.code} - {area.name}</option>)}</select>
      <div className="space-y-1"><input type="search" value={locations.search} onChange={(event) => locations.setSearch(event.target.value)} placeholder="Tìm vị trí kho trên server..." className={inputClassName} /><select value={resource.query.storageLocationId ?? ''} onChange={(event) => resource.updateQuery({ storageLocationId: event.target.value || undefined })} className={inputClassName} disabled={locations.loading}><option value="">{locations.loading ? 'Đang tải vị trí...' : 'Tất cả vị trí kho'}</option>{locations.items.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}</select></div>
      <select value={resource.query.type ?? ''} onChange={(event) => resource.updateQuery({ type: (event.target.value || undefined) as StockTransactionType | undefined })} className={inputClassName}><option value="">Tất cả transaction type</option>{STOCK_TRANSACTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <input type="text" value={resource.query.createdBy ?? ''} onChange={(event) => resource.updateQuery({ createdBy: event.target.value.trim() || undefined })} placeholder="Created by UUID" className={inputClassName} />
      <input type="date" value={resource.query.dateFrom ?? ''} onChange={(event) => resource.updateQuery({ dateFrom: event.target.value || undefined })} className={inputClassName} aria-label="Từ ngày" />
      <input type="date" value={resource.query.dateTo ?? ''} onChange={(event) => resource.updateQuery({ dateTo: event.target.value || undefined })} className={inputClassName} aria-label="Đến ngày" />
    </div>
    {[supplies.error, areas.error, locations.error].some(Boolean) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Một số bộ lọc không tải được. Danh sách transaction vẫn được hiển thị nếu API chính hoạt động.</p>}
    {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload} /> : <DataTable columns={columns} data={resource.items} keyExtractor={(item) => item.id} searchPlaceholder="Tìm transaction, vật tư, lý do..." searchValue={searchInput} onSearchChange={setSearchInput} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có transaction phù hợp với bộ lọc." />}
    {detailOpen && <CrudModal title="Chi tiết stock transaction" onClose={() => setDetailOpen(false)}>{detailLoading ? <LoadingState label="Đang tải chi tiết transaction..." /> : detailError ? <ErrorState message={detailError} onRetry={() => { if (detailId) void openDetail(detailId); }} /> : detail ? <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{[['Type', detail.type], ['Vật tư', detail.supply ? `${detail.supply.code}${detail.supply.description ? ` - ${detail.supply.description}` : ''}` : detail.supply_id], ['Khu vực', detail.area ? `${detail.area.code} - ${detail.area.name}` : detail.area_id], ['Vị trí kho', detail.storage_location ? `${detail.storage_location.code}${detail.storage_location.name ? ` - ${detail.storage_location.name}` : ''}` : detail.storage_location_id], ['Số lượng', numberFormatter.format(detail.quantity)], ['Tồn trước', numberFormatter.format(detail.before_quantity)], ['Tồn sau', numberFormatter.format(detail.after_quantity)], ['Lý do', detail.reason || '—'], ['Ghi chú', detail.note || '—'], ['Người tạo', detail.creator ? `${detail.creator.first_name} ${detail.creator.last_name}`.trim() : detail.created_by], ['Thời gian', dateFormatter.format(new Date(detail.created_at))], ['Order ID', detail.order_id || '—']].map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value}</dd></div>)}</dl> : null}</CrudModal>}
    {adjustmentOpen && canAdjust && <StockAdjustmentModal busy={resource.mutating} onClose={() => setAdjustmentOpen(false)} onSubmit={createAdjustment} />}
  </div>;
};

export default StockTransactionsPage;
