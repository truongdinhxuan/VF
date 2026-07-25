import { useCallback, useEffect, useState } from 'react';
import { listAreas } from '../../../api/areas.service';
import { listStockBalances } from '../../../api/stock-balances.service';
import { createStockAdjustment } from '../../../api/stock-transactions.service';
import { listStorageLocations } from '../../../api/storage-locations.service';
import { listSupplies } from '../../../api/supplies.service';
import { DataTable, type Column } from '../../../components/admin/DataTable';
import { CrudFeedbackToast, CrudPageHeader, ErrorState, inputClassName } from '../../../components/admin/crud/CrudPrimitives';
import { StockAdjustmentModal } from '../../../components/admin/stock/StockAdjustmentModal';
import { SelectSkeleton } from '../../../components/common/skeleton';
import { STOCK_MUTATOR_ROLES } from '../../../constants/roles';
import { useAuth } from '../../../context/AuthContext';
import { useCrudResource } from '../../../hooks/useCrudResource';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePaginatedResource } from '../../../hooks/usePaginatedResource';
import { useServerLookup } from '../../../hooks/useServerLookup';
import { queryKeys } from '../../../lib/queryKeys';
import type { PaginationParams } from '../../../types/pagination.types';
import type { StockBalance, StockBalanceListParams } from '../../../types/stock-balances';
import type { CreateStockAdjustmentInput } from '../../../types/stock-transactions';

const loadAreas = async (signal: AbortSignal) =>
  (await listAreas(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

const StockBalancesPage = () => {
  const { role } = useAuth();
  const canAdjust = role !== null && STOCK_MUTATOR_ROLES.includes(role);
  const loader = useCallback((query: StockBalanceQuery, signal: AbortSignal) => listStockBalances(query, signal), []);
  const resource = usePaginatedResource<StockBalance, StockBalanceQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'updated_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải dữ liệu tồn kho.',
    queryKey: queryKeys.stockBalances.lists,
    invalidateQueryKeys: [queryKeys.stockTransactions.all],
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

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  const columns: Column<StockBalance>[] = [
    { header: 'Vật tư', accessor: 'supply_id', render: (item) => item.supply ? <div><p className="font-semibold text-slate-800">{item.supply.code}</p><p className="text-xs text-slate-500">{item.supply.description || '—'}</p></div> : '—' },
    { header: 'Khu vực', accessor: 'area_id', render: (item) => item.area ? `${item.area.code} - ${item.area.name}` : '—' },
    { header: 'Vị trí kho', accessor: 'storage_location_id', render: (item) => item.storage_location ? `${item.storage_location.code}${item.storage_location.name ? ` - ${item.storage_location.name}` : ''}` : '—' },
    { header: 'Số lượng', accessor: 'quantity', sortKey: 'quantity', render: (item) => <span className="font-bold text-slate-900">{numberFormatter.format(item.quantity)} {item.supply?.unit?.symbol ?? ''}</span> },
    { header: 'Cập nhật lúc', accessor: 'updated_at', sortKey: 'updated_at', render: (item) => dateFormatter.format(new Date(item.updated_at)) },
  ];

  const createAdjustment = (input: CreateStockAdjustmentInput) => resource.runMutation(
    () => createStockAdjustment(input),
    'Đã cập nhật tồn kho và tạo stock transaction.',
    'Không thể tạo stock adjustment.',
  );

  return <div className="space-y-6">
    <CrudPageHeader title="Stock balances" description="Tồn kho hiện tại theo vật tư, khu vực và vị trí lưu." createLabel="Tạo adjustment" onCreate={canAdjust ? () => setAdjustmentOpen(true) : undefined} />
    <CrudFeedbackToast feedback={resource.feedback} onClose={() => resource.setFeedback(null)} />
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-1">
        <input type="search" value={supplies.search} onChange={(event) => supplies.setSearch(event.target.value)} placeholder="Tìm vật tư trên server..." className={inputClassName} />
        {supplies.loading && supplies.items.length === 0 ? <SelectSkeleton label="Đang tải bộ lọc vật tư" /> : <select value={resource.query.supplyId ?? ''} onChange={(event) => resource.updateQuery({ supplyId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả vật tư</option>{supplies.items.map((supply) => <option key={supply.id} value={supply.id}>{supply.code}{supply.description ? ` - ${supply.description}` : ''}</option>)}</select>}
      </div>
      {areas.loading && areas.items.length === 0 ? <SelectSkeleton label="Đang tải bộ lọc khu vực" /> : <select value={resource.query.areaId ?? ''} onChange={(event) => resource.updateQuery({ areaId: event.target.value || undefined, storageLocationId: undefined })} className={inputClassName}><option value="">Tất cả khu vực</option>{areas.items.map((area) => <option key={area.id} value={area.id}>{area.code} - {area.name}</option>)}</select>}
      <div className="space-y-1">
        <input type="search" value={locations.search} onChange={(event) => locations.setSearch(event.target.value)} placeholder="Tìm vị trí kho trên server..." className={inputClassName} />
        {locations.loading && locations.items.length === 0 ? <SelectSkeleton label="Đang tải bộ lọc vị trí kho" /> : <select value={resource.query.storageLocationId ?? ''} onChange={(event) => resource.updateQuery({ storageLocationId: event.target.value || undefined })} className={inputClassName}><option value="">Tất cả vị trí kho</option>{locations.items.map((location) => <option key={location.id} value={location.id}>{location.code}{location.name ? ` - ${location.name}` : ''}</option>)}</select>}
      </div>
    </div>
    {[supplies.error, areas.error, locations.error].some(Boolean) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Một số bộ lọc không tải được. Dữ liệu tồn kho vẫn được hiển thị nếu API chính hoạt động.</p>}
    {resource.error ? <ErrorState message={resource.error} onRetry={resource.reload} /> : <DataTable columns={columns} data={resource.items} loading={resource.loading} keyExtractor={(item) => item.id} searchPlaceholder="Tìm mã vật tư, khu vực, vị trí..." searchValue={searchInput} onSearchChange={setSearchInput} pagination={resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} sortBy={resource.query.sortBy} sortOrder={resource.query.sortOrder} onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })} emptyText="Không có tồn kho phù hợp với bộ lọc." />}
    {adjustmentOpen && canAdjust && <StockAdjustmentModal busy={resource.mutating} onClose={() => setAdjustmentOpen(false)} onSubmit={createAdjustment} />}
  </div>;
};

export default StockBalancesPage;
type StockBalanceQuery = StockBalanceListParams & PaginationParams;
