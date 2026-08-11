import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMilkrunStockBalances } from '../../api/milkrun-stock.service';
import { InfoButton } from '../../components/common/Button';
import { DataTable, type Column } from '../../components/common/DataTable';
import { CrudPageHeader, ErrorState } from '../../components/crud/CrudPrimitives';
import { PERMISSION_CODE } from '../../constants/permissions';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunStockBalance, MilkrunStockBalanceListParams } from '../../types/milkrun';
import type { PaginationParams } from '../../types/pagination.types';

type StockBalanceQuery = MilkrunStockBalanceListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const StockBalancesPage = () => {
  const { role, hasPermission } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 400);
  const loader = useCallback(
    (query: StockBalanceQuery, signal: AbortSignal) =>
      listMilkrunStockBalances(query, signal),
    [],
  );
  const resource = usePaginatedResource<MilkrunStockBalance, StockBalanceQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'updated_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải tồn Rack.',
    queryKey: queryKeys.milkrunStockBalances.lists,
  });
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const normalized = search.trim() || undefined;
    if (normalized !== resourceSearch) updateResourceQuery({ search: normalized });
  }, [resourceSearch, search, updateResourceQuery]);

  const columns = useMemo<Column<MilkrunStockBalance>[]>(() => [
    { header: 'Mã Rack', accessor: 'rack', render: (item) => item.rack?.code ?? item.rack_id },
    { header: 'Tên Rack', accessor: 'rack_name', render: (item) => item.rack?.name ?? '—' },
    { header: 'Area', accessor: 'area', render: (item) => item.area ? `${item.area.code} — ${item.area.name}` : item.area_id },
    { header: 'Số lượng tồn', accessor: 'quantity', sortKey: 'quantity', render: (item) => Number(item.quantity).toLocaleString('vi-VN') },
    { header: 'Cập nhật gần nhất', accessor: 'updated_at', sortKey: 'updated_at', render: (item) => formatDate(item.updated_at) },
  ], []);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CrudPageHeader
          title="Tồn Rack"
          description="Tồn hiện tại tại EDC Logistics; mọi thay đổi phải đi qua Trip hoặc Adjustment."
        />
        {hasPermission(PERMISSION_CODE.MILKRUN_STOCK_ADJUST) && (
          <Link to={getWorkspacePath(role, 'milkrun/adjustments')} className={InfoButton}>
            Cân / điều chỉnh tồn
          </Link>
        )}
      </div>
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <DataTable
          columns={columns}
          data={resource.items}
          loading={resource.loading}
          keyExtractor={(item) => item.id}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Tìm mã hoặc tên Rack..."
          pagination={resource.pagination}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
          sortBy={resource.query.sortBy}
          sortOrder={resource.query.sortOrder}
          onSortChange={(sortBy, sortOrder) => resource.updateQuery({ sortBy, sortOrder })}
          emptyText="Chưa có tồn Rack."
        />
      )}
    </section>
  );
};

export default StockBalancesPage;
