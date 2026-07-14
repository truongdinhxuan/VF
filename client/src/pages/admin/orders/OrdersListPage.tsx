import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../../../api/errors";
import { listOrders } from "../../../api/orders.service";
import { OrderStatusBadge } from "../../../components/admin/orders/OrderStatusBadge";
import { PACKING_ROLE } from "../../../constants/roles";
import { useAuth } from "../../../context/AuthContext";
import { ORDER_STATUSES, type Order, type OrderListParams, type OrderStatus } from "../../../types/orders";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );

const OrdersListPage = () => {
  const { role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [params, setParams] = useState<OrderListParams>({});

  useEffect(() => {
    let active = true;
    listOrders(params)
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError, "Không thể tải danh sách order."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  const visibleOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return orders;
    return orders.filter((order) =>
      [order.code, order.from_area_id, order.to_area_id, order.requested_by]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [orders, search]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setParams({ status: status || undefined, date: date || undefined });
  };

  const retry = () => {
    setLoading(true);
    setError(null);
    setParams((current) => ({ ...current }));
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Order management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo, gửi, duyệt và cấp hàng theo đúng trạng thái của order.
          </p>
        </div>
        {role === PACKING_ROLE && (
          <Link
            to="/admin/orders/create"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Tạo order
          </Link>
        )}
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_190px_180px_auto]"
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo mã order, area hoặc người tạo"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | OrderStatus)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Lọc
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Đang tải danh sách order...</div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
            <button onClick={retry} className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
              Thử lại
            </button>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-slate-700">Không có order phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">Thay đổi bộ lọc hoặc tạo order mới nếu bạn có quyền.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Mã order</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">Từ area</th>
                  <th className="px-5 py-3">Đến area</th>
                  <th className="px-5 py-3">Ngày tạo</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-semibold text-slate-900">{order.code}</td>
                    <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{order.from_area_id}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{order.to_area_id}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(order.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link to={`/admin/orders/${order.id}`} className="font-semibold text-blue-600 hover:text-blue-800">
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default OrdersListPage;
