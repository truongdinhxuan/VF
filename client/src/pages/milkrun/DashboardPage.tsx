import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMilkrunDashboard } from '../../api/milkrun-dashboard.service';
import { getApiErrorMessage } from '../../api/errors';
import { SecondaryButton } from '../../components/common/Button';
import { CardSkeleton } from '../../components/common/skeleton';
import { queryKeys } from '../../lib/queryKeys';
import type { MilkrunDashboardParams } from '../../types/milkrun';

const numberFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2,
});

const toBoundaryIso = (date: string, endOfDay: boolean): string | undefined => {
  if (!date) return undefined;
  const value = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return value.toISOString();
};

const formatMinutes = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'Chưa có dữ liệu';
  if (value < 60) return `${numberFormatter.format(value)} phút`;
  return `${numberFormatter.format(value / 60)} giờ`;
};

const MetricCard = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
  </article>
);

const DashboardPage = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const params = useMemo<MilkrunDashboardParams>(() => ({
    dateFrom: toBoundaryIso(dateFrom, false),
    dateTo: toBoundaryIso(dateTo, true),
  }), [dateFrom, dateTo]);
  const dashboardQuery = useQuery({
    queryKey: queryKeys.milkrunDashboard.detail({ ...params }),
    queryFn: ({ signal }) => getMilkrunDashboard(params, signal),
    staleTime: 60 * 1000,
  });

  if (dashboardQuery.isPending) {
    return (
      <section className="space-y-5" aria-label="Đang tải Dashboard Milkrun">
        <CardSkeleton lines={2} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <CardSkeleton key={index} lines={2} />
          ))}
        </div>
      </section>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <h1 className="text-lg font-bold">Không thể tải Dashboard Milkrun</h1>
        <p className="mt-2 text-sm">
          {getApiErrorMessage(dashboardQuery.error, 'Vui lòng thử lại.')}
        </p>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          className={`${SecondaryButton} mt-4`}
        >
          Thử lại
        </button>
      </section>
    );
  }

  const dashboard = dashboardQuery.data;
  const topShop = dashboard.top_shop;
  const topReceivedRack = dashboard.top_received_rack;
  const topReturnedRack = dashboard.top_returned_rack;

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Milkrun · Báo cáo</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard Milkrun</h1>
          <p className="mt-1 text-sm text-slate-500">
            Số liệu được tính trực tiếp từ Trip, TripItems, tồn rack và giao dịch rack.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Từ ngày
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Đến ngày
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      </header>

      {dashboardQuery.isFetching && (
        <p role="status" className="text-xs font-medium text-blue-600">
          Đang cập nhật báo cáo…
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng số chuyến" value={numberFormatter.format(dashboard.total_trips)} />
        <MetricCard
          label="Shop đi nhiều nhất"
          value={topShop ? `${topShop.code} — ${topShop.name}` : 'Chưa có dữ liệu'}
          description={topShop ? `${numberFormatter.format(topShop.trip_count)} chuyến` : undefined}
        />
        <MetricCard
          label="Thời gian chuyến trung bình"
          value={formatMinutes(dashboard.trip_duration.average_minutes)}
          description={`${numberFormatter.format(dashboard.trip_duration.trip_count)} chuyến có đủ mốc thời gian`}
        />
        <MetricCard label="Số lần cân tồn" value={numberFormatter.format(dashboard.adjustment_count)} />
        <MetricCard
          label="Rack nhận nhiều nhất"
          value={topReceivedRack ? `${topReceivedRack.code} — ${topReceivedRack.name}` : 'Chưa có dữ liệu'}
          description={topReceivedRack ? `${numberFormatter.format(topReceivedRack.quantity)} rack` : undefined}
        />
        <MetricCard
          label="Rack trả nhiều nhất"
          value={topReturnedRack ? `${topReturnedRack.code} — ${topReturnedRack.name}` : 'Chưa có dữ liệu'}
          description={topReturnedRack ? `${numberFormatter.format(topReturnedRack.quantity)} rack` : undefined}
        />
        <MetricCard
          label="Tồn rack hiện tại"
          value={numberFormatter.format(dashboard.current_stock.total_quantity)}
          description={`${numberFormatter.format(dashboard.current_stock.racks.length)} mã rack`}
        />
        <MetricCard
          label="Tài xế phát sinh chuyến"
          value={numberFormatter.format(dashboard.trips_by_driver.length)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-900">Số chuyến theo tài xế</h2>
          </div>
          {dashboard.trips_by_driver.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Chưa có chuyến phù hợp bộ lọc.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-5 py-3">Tài xế</th><th className="px-5 py-3 text-right">Số chuyến</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboard.trips_by_driver.map((driver) => (
                    <tr key={driver.id}>
                      <td className="px-5 py-3 text-slate-700">{driver.first_name} {driver.last_name} ({driver.vinfast_id})</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{numberFormatter.format(driver.trip_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-900">Thời gian tài xế tại Shop</h2>
          </div>
          {dashboard.driver_shop_time.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Chưa có đủ mốc time_arrived và time_lift_down.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-5 py-3">Tài xế</th><th className="px-5 py-3 text-right">Trung bình</th><th className="px-5 py-3 text-right">Tổng</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboard.driver_shop_time.map((driver) => (
                    <tr key={driver.id}>
                      <td className="px-5 py-3 text-slate-700">{driver.first_name} {driver.last_name}</td>
                      <td className="px-5 py-3 text-right">{formatMinutes(driver.average_minutes)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatMinutes(driver.total_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">Tồn rack hiện tại tại EDC Logistics</h2>
        </div>
        {dashboard.current_stock.racks.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Chưa có StockBalance rack.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-5 py-3">Mã rack</th><th className="px-5 py-3">Tên rack</th><th className="px-5 py-3 text-right">Số lượng</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.current_stock.racks.map((rack) => (
                  <tr key={rack.id}>
                    <td className="px-5 py-3 font-mono text-slate-700">{rack.code}</td>
                    <td className="px-5 py-3 text-slate-700">{rack.name}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{numberFormatter.format(rack.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
};

export default DashboardPage;
