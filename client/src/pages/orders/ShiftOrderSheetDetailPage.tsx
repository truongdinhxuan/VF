import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/errors';
import {
  exportShiftOrderSheet,
  getShiftOrderSheet,
} from '../../api/shift-order-sheets.service';
import { InfoButton, TextButton } from '../../components/common/Button';
import { CardSkeleton } from '../../components/common/skeleton';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge';
import { getWorkspacePath } from '../../constants/workspaces';
import { ORDER_READ_PERMISSIONS } from '../../constants/workspaceNavigation';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import type { OrderStatus } from '../../types/orders';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const formatDateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value))
  : '—';

const ShiftOrderSheetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { role, hasAnyPermission } = useAuth();
  const listPath = getWorkspacePath(role, 'shift-order-sheets');
  const createPath = getWorkspacePath(role, 'orders/create');
  const ordersPath = getWorkspacePath(role, 'orders');
  const query = useQuery({
    queryKey: queryKeys.shiftOrderSheets.detail(id ?? ''),
    queryFn: ({ signal }) => getShiftOrderSheet(id!, signal),
    enabled: Boolean(id),
  });
  const exportMutation = useMutation({
    mutationFn: () => exportShiftOrderSheet(id!),
    onSuccess: ({ blob, fileName }) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName ?? 'Phieu_Order_Ca.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    },
  });

  if (query.isPending) return <CardSkeleton lines={6} label="Đang tải Phiếu Order Ca" />;
  if (query.isError || !query.data) return (
    <section className="space-y-4">
      <Link to={listPath} className={TextButton}>← Danh sách Phiếu Order Ca</Link>
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
        {getApiErrorMessage(query.error, 'Không thể tải Phiếu Order Ca.')}
      </div>
    </section>
  );

  const sheet = query.data;
  const leaderName = sheet.leader
    ? `${sheet.leader.first_name} ${sheet.leader.last_name}`.trim()
    : 'Không xác định';

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={listPath} className={TextButton}>← Danh sách Phiếu Order Ca</Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Phiếu Order Ca</h1>
          <p className="mt-1 text-sm text-slate-500">Trạng thái Order được đọc trực tiếp từ Order hiện tại.</p>
        </div>
        <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:flex-wrap sm:items-center sm:justify-end">
          {hasAnyPermission(ORDER_READ_PERMISSIONS) && (
            <button
              type="button"
              className={InfoButton}
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          )}
          <Link to={`${createPath}?shiftOrderSheetId=${sheet.id}`} className={InfoButton}>+ Tạo thêm Order</Link>
        </div>
      </div>

      {exportMutation.isError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {getApiErrorMessage(exportMutation.error, 'Không thể tạo file Excel. Vui lòng thử lại.')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Tổ trưởng" value={leaderName} />
        <Info label="Area" value={sheet.area ? `${sheet.area.code} — ${sheet.area.name}` : '—'} />
        <Info label="Ca" value={sheet.work_shift ? `${sheet.work_shift.code} — ${sheet.work_shift.name}` : '—'} />
        <Info label="Ngày làm việc" value={new Intl.DateTimeFormat('vi-VN', { timeZone: BUSINESS_TIME_ZONE }).format(new Date(`${sheet.work_date}T00:00:00+07:00`))} />
        <Info label="Bắt đầu ca" value={formatDateTime(sheet.shift_start_at)} />
        <Info label="Kết thúc ca" value={formatDateTime(sheet.shift_end_at)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">Orders</h2>
          <p className="mt-1 text-sm text-slate-500">{sheet.orders.length} Order từ PENDING trở đi</p>
        </div>
        {sheet.orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Phiếu chưa có Order đã submit.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Mã Order</th><th className="px-5 py-3">Người Order</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Tạo lúc</th><th className="px-5 py-3">Từ Area</th><th className="px-5 py-3">Đến Area</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {sheet.orders.map((order) => {
                  const requester = order.requester ? `${order.requester.first_name} ${order.requester.last_name}`.trim() : 'Không xác định';
                  const status = (order.status_lookup?.code ?? order.status) as OrderStatus;
                  return <tr key={order.id} className="hover:bg-slate-50/80"><td className="px-5 py-4 font-semibold text-slate-900">{order.code}</td><td className="px-5 py-4">{requester}</td><td className="px-5 py-4"><OrderStatusBadge status={status} /></td><td className="px-5 py-4">{formatDateTime(order.created_at)}</td><td className="px-5 py-4">{order.from_area?.name ?? '—'}</td><td className="px-5 py-4">{order.to_area?.name ?? '—'}</td><td className="px-5 py-4">{order.order_items?.length ?? 0}</td><td className="px-5 py-4"><Link to={`${ordersPath}/${order.id}`} className={TextButton}>Chi tiết</Link></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
  </div>
);

export default ShiftOrderSheetDetailPage;
