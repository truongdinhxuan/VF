import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrders } from '../../api/orders.service';
import { InfoButton, TextButton } from '../../components/common/Button';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/skeleton';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge';
import { ORDER_CREATOR_ROLES } from '../../constants/roles';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { queryKeys } from '../../lib/queryKeys';
import type { PaginationParams } from '../../types/pagination.types';
import { ORDER_STATUSES, type Order, type OrderListParams, type OrderStatus } from '../../types/orders';
type OrderQuery = OrderListParams & PaginationParams;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const controlClassName = 'rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const OrdersListPage = () => {
  const { role } = useAuth();
  const ordersPath = getWorkspacePath(role, 'orders');
  const createOrderPath = getWorkspacePath(role, 'orders/create');
  const loader = useCallback((query: OrderQuery, signal: AbortSignal) => listOrders(query, signal), []);
  const resource = usePaginatedResource<Order, OrderQuery>({
    loader,
    initialQuery: { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
    loadErrorMessage: 'Không thể tải danh sách order.',
    queryKey: queryKeys.orders.lists,
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const resourceSearch = resource.query.search;
  const updateResourceQuery = resource.updateQuery;

  useEffect(() => {
    const search = debouncedSearch.trim() || undefined;
    if (search !== resourceSearch) updateResourceQuery({ search });
  }, [debouncedSearch, resourceSearch, updateResourceQuery]);

  return <section className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Order management</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Orders</h1><p className="mt-1 text-sm text-slate-500">Tạo, gửi, duyệt và cấp hàng theo đúng trạng thái của order.</p></div>
      {role !== null && ORDER_CREATOR_ROLES.includes(role) && <Link to={createOrderPath} className={InfoButton}>Tạo order</Link>}
    </div>

    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
      <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm mã order, area hoặc người tạo" className={controlClassName} />
      <select value={resource.query.status ?? ''} onChange={(event) => resource.updateQuery({ status: (event.target.value || undefined) as OrderStatus | undefined })} className={controlClassName}><option value="">Tất cả trạng thái</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
      <input type="text" value={resource.query.createdBy ?? ''} onChange={(event) => resource.updateQuery({ createdBy: event.target.value.trim() || undefined })} placeholder="Created by UUID" className={controlClassName} />
      <input type="text" value={resource.query.areaId ?? ''} onChange={(event) => resource.updateQuery({ areaId: event.target.value.trim() || undefined })} placeholder="Area UUID" className={controlClassName} />
      <input type="date" value={resource.query.dateFrom ?? ''} onChange={(event) => resource.updateQuery({ dateFrom: event.target.value || undefined })} className={controlClassName} aria-label="Từ ngày" />
      <input type="date" value={resource.query.dateTo ?? ''} onChange={(event) => resource.updateQuery({ dateTo: event.target.value || undefined })} className={controlClassName} aria-label="Đến ngày" />
      <select value={resource.query.sortBy ?? 'created_at'} onChange={(event) => resource.updateQuery({ sortBy: event.target.value })} className={controlClassName}><option value="created_at">Ngày tạo</option><option value="updated_at">Ngày cập nhật</option><option value="code">Mã order</option><option value="status">Trạng thái</option></select>
      <select value={resource.query.sortOrder ?? 'desc'} onChange={(event) => resource.updateQuery({ sortOrder: event.target.value as 'asc' | 'desc' })} className={controlClassName}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select>
    </div>

    {resource.loading && resource.items.length === 0 ? (
      <TableSkeleton columns={6} showToolbar={false} label="Đang tải danh sách order" />
    ) : (
      <>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={resource.loading}>
          {resource.loading && <div role="status" aria-live="polite" className="absolute right-3 top-3 z-10 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">Đang cập nhật...</div>}
          {resource.error ? <div className="p-10 text-center"><p className="text-sm font-semibold text-rose-700">{resource.error}</p><button type="button" onClick={resource.reload} className={`${TextButton} mt-3`}>Thử lại</button></div> : resource.items.length === 0 ? <div className="p-10 text-center"><p className="font-semibold text-slate-700">Không có order phù hợp</p><p className="mt-1 text-sm text-slate-500">Thay đổi bộ lọc hoặc tạo order mới nếu bạn có quyền.</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Mã order</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Từ area</th><th className="px-5 py-3">Đến area</th><th className="px-5 py-3">Ngày tạo</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{resource.items.map((order) => <tr key={order.id} className="hover:bg-slate-50/80"><td className="px-5 py-4 font-semibold text-slate-900">{order.code}</td><td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td><td className="px-5 py-4 text-slate-600">{order.from_area?.name ?? order.from_area_id}</td><td className="px-5 py-4 text-slate-600">{order.to_area?.name ?? order.to_area_id}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(order.created_at)}</td><td className="px-5 py-4 text-right"><Link to={`${ordersPath}/${order.id}`} className={TextButton}>Xem chi tiết</Link></td></tr>)}</tbody></table></div>}
        </div>
        {!resource.error && <Pagination {...resource.pagination} onPageChange={resource.setPage} onPageSizeChange={resource.setPageSize} />}
      </>
    )}
  </section>;
};

export default OrdersListPage;
