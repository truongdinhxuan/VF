import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  arriveMilkrunTrip,
  cancelMilkrunTrip,
  getMilkrunTrip,
  startMilkrunTrip,
} from '../../api/milkrun-trips.service';
import { getApiErrorMessage } from '../../api/errors';
import { ErrorButton, InfoButton, SecondaryButton, TextButton } from '../../components/common/Button';
import { PageSkeleton } from '../../components/common/skeleton';
import { PERMISSION_CODE } from '../../constants/permissions';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { MILKRUN_TRIP_STATUS, type MilkrunTrip } from '../../types/milkrun';

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { role, hasPermission } = useAuth();
  const tripsPath = getWorkspacePath(role, 'milkrun/trips');
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const tripQuery = useQuery({
    queryKey: queryKeys.milkrunTrips.detail(id ?? ''),
    queryFn: ({ signal }) => getMilkrunTrip(id!, signal),
    enabled: Boolean(id),
  });
  const actionMutation = useMutation({
    mutationFn: (action: () => Promise<MilkrunTrip>) => action(),
    onSuccess: async (trip) => {
      queryClient.setQueryData(queryKeys.milkrunTrips.detail(trip.id), trip);
      await queryClient.invalidateQueries({ queryKey: queryKeys.milkrunTrips.lists });
      setFeedback('Cập nhật trạng thái Trip thành công.');
      setCancelOpen(false);
      setCancelReason('');
    },
    onError: (error) => setFeedback(getApiErrorMessage(error, 'Không thể cập nhật trạng thái Trip.')),
  });

  if (tripQuery.isPending) return <PageSkeleton />;
  if (tripQuery.isError || !tripQuery.data) {
    return (
      <section className="space-y-4">
        <Link to={tripsPath} className={TextButton}>← Danh sách Trip</Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {getApiErrorMessage(tripQuery.error, 'Không thể tải Milkrun Trip.')}
        </div>
      </section>
    );
  }

  const trip = tripQuery.data;
  const status = trip.status?.code;
  const canCancel = hasPermission(PERMISSION_CODE.MILKRUN_TRIP_CREATE)
    && (status === MILKRUN_TRIP_STATUS.REGISTERED || status === MILKRUN_TRIP_STATUS.STARTED);

  return (
    <section className="space-y-5">
      <div>
        <Link to={tripsPath} className={TextButton}>← Danh sách Trip</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{trip.code}</h1>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
            {trip.status?.code ?? trip.status_id}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Trip trực tiếp, không qua Order và chưa cập nhật tồn kho ở Phase 7.</p>
      </div>

      {feedback && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{feedback}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Driver"
          value={trip.driver
            ? `${trip.driver.first_name} ${trip.driver.last_name} (${trip.driver.vinfast_id})${trip.driver.is_active === false || trip.driver.is_deleted ? ' — không hoạt động' : ''}`
            : 'Không tìm thấy tài xế'}
        />
        <InfoCard label="Area" value={trip.area ? `${trip.area.code} — ${trip.area.name}` : trip.area_id} />
        <InfoCard label="Shop" value={trip.shop ? `${trip.shop.code} — ${trip.shop.name}` : trip.shop_id} />
        <InfoCard label="Trip Type" value={trip.trip_type ? `${trip.trip_type.code} — ${trip.trip_type.name}` : trip.trip_type_id} />
        <InfoCard label="Bắt đầu" value={formatDate(trip.time_start)} />
        <InfoCard label="Đến Shop" value={formatDate(trip.time_arrived)} />
        <InfoCard label="Ngày tạo" value={formatDate(trip.created_at)} />
        <InfoCard label="Attachment" value={trip.attachment_url ?? '—'} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">Thao tác trạng thái</h2><p className="text-sm text-slate-500">Backend kiểm tra lại permission, ownership và StatusFlow.</p></div>
          <div className="flex flex-wrap gap-2">
            {status === MILKRUN_TRIP_STATUS.REGISTERED && hasPermission(PERMISSION_CODE.MILKRUN_TRIP_START) && (
              <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate(() => startMilkrunTrip(trip.id))} className={InfoButton}>START</button>
            )}
            {status === MILKRUN_TRIP_STATUS.STARTED && hasPermission(PERMISSION_CODE.MILKRUN_TRIP_ARRIVE) && (
              <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate(() => arriveMilkrunTrip(trip.id))} className={InfoButton}>ARRIVE</button>
            )}
            {canCancel && (
              <button type="button" disabled={actionMutation.isPending} onClick={() => setCancelOpen(true)} className={ErrorButton}>CANCEL</button>
            )}
          </div>
        </div>
        {cancelOpen && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1 text-sm font-semibold text-slate-700">
              Lý do hủy (lưu vào ghi chú Trip)
              <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={2000} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
            </label>
            <button type="button" onClick={() => setCancelOpen(false)} className={SecondaryButton}>Bỏ qua</button>
            <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate(() => cancelMilkrunTrip(trip.id, cancelReason))} className={ErrorButton}>Xác nhận hủy</button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5"><h2 className="font-bold text-slate-900">Trip Items</h2><p className="text-sm text-slate-500">{trip.items?.length ?? 0} dòng Rack</p></div>
        {!trip.items?.length ? <p className="p-8 text-center text-sm text-slate-500">Không có Trip Item.</p> : (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Rack</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">{trip.items.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold text-slate-900">{item.rack ? `${item.rack.code} — ${item.rack.name}` : item.rack_id}</td><td className="px-5 py-4">{item.quantity}</td><td className="px-5 py-4 text-slate-600">{item.note ?? '—'}</td></tr>)}</tbody></table></div>
        )}
      </div>

      {trip.note && <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700"><strong>Ghi chú:</strong><pre className="mt-2 whitespace-pre-wrap font-sans">{trip.note}</pre></div>}
    </section>
  );
};

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold text-slate-800">{value}</p>
  </div>
);

export default TripDetailPage;
