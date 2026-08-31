import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignUserWorkShift,
  getUserWorkShiftAssignments,
  getWorkShifts,
} from '../../api/work-shifts.service';
import { getApiErrorMessage } from '../../api/errors';
import { InfoButton } from '../common/Button';
import { SelectSkeleton, Skeleton } from '../common/skeleton';
import { FieldError, inputClassName, labelClassName } from '../crud/CrudPrimitives';
import { queryKeys } from '../../lib/queryKeys';

const toLocalDateTimeInput = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const formatDateTime = (value: string | null): string => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Hiện tại';

const displayUser = (user: { first_name: string; last_name: string; email: string }) =>
  `${user.first_name} ${user.last_name}`.trim() || user.email;

export const UserWorkShiftPanel = ({ userId, canAssign }: {
  userId: string;
  canAssign: boolean;
}) => {
  const queryClient = useQueryClient();
  const shiftsQuery = useQuery({
    queryKey: queryKeys.workShifts.lookup(),
    queryFn: ({ signal }) => getWorkShifts(signal),
    staleTime: 15 * 60 * 1000,
  });
  const assignmentQuery = useQuery({
    queryKey: queryKeys.userWorkShiftAssignments.detail(userId),
    queryFn: ({ signal }) => getUserWorkShiftAssignments(userId, signal),
  });
  const assignmentMutation = useMutation({ mutationFn: assignUserWorkShift });
  const [workShiftId, setWorkShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => toLocalDateTimeInput(new Date()));
  const [feedback, setFeedback] = useState<string | null>(null);
  const current = assignmentQuery.data?.current;
  const history = assignmentQuery.data?.history ?? [];
  const selectedWorkShiftId = workShiftId || current?.work_shift_id || '';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    if (!selectedWorkShiftId || !effectiveFrom) return;
    try {
      await assignmentMutation.mutateAsync({
        user_id: userId,
        work_shift_id: selectedWorkShiftId,
        effective_from: new Date(effectiveFrom).toISOString(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.userWorkShiftAssignments.detail(userId),
      });
      setFeedback('Đã cập nhật ca làm việc. Lịch sử cũ được giữ nguyên.');
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể cập nhật ca làm việc.'));
    }
  };

  return (
    <section className="space-y-4 border-t border-slate-200 pt-5">
      <div>
        <h3 className="text-base font-bold text-slate-900">Ca làm việc</h3>
        <p className="text-sm text-slate-500">Ca được resolve từ assignment, không suy đoán chỉ bằng giờ.</p>
      </div>

      {assignmentQuery.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : assignmentQuery.isError ? (
        <FieldError message={getApiErrorMessage(assignmentQuery.error, 'Không thể tải lịch sử ca làm việc.')} />
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <span className="font-semibold">Ca hiện tại: </span>
          {current
            ? `${current.work_shift.code} — ${current.work_shift.name} (${current.work_shift.start_time.slice(0, 5)}–${current.work_shift.end_time.slice(0, 5)})`
            : 'Chưa được gán ca'}
        </div>
      )}

      {canAssign && (
        <form onSubmit={(event) => void submit(event)} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
          <label className={labelClassName}>
            <span>Ca mới</span>
            {shiftsQuery.isPending ? <SelectSkeleton label="Đang tải ca làm việc" /> : (
              <select
                value={selectedWorkShiftId}
                onChange={(event) => setWorkShiftId(event.target.value)}
                className={inputClassName}
                required
              >
                <option value="">Chọn ca</option>
                {(shiftsQuery.data ?? []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.code} — {shift.name} ({shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)})
                  </option>
                ))}
              </select>
            )}
            {shiftsQuery.isError && <FieldError message={getApiErrorMessage(shiftsQuery.error, 'Không thể tải ca làm việc.')} />}
          </label>
          <label className={labelClassName}>
            <span>Hiệu lực từ</span>
            <input
              type="datetime-local"
              value={effectiveFrom}
              max={toLocalDateTimeInput(new Date())}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              className={inputClassName}
              required
            />
          </label>
          <div className="flex flex-col items-stretch gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            {feedback ? <p className="text-sm text-slate-700" role="status">{feedback}</p> : <span />}
            <button
              type="submit"
              className={InfoButton}
              disabled={assignmentMutation.isPending || shiftsQuery.isPending || !selectedWorkShiftId || !effectiveFrom}
            >
              {assignmentMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật ca'}
            </button>
          </div>
        </form>
      )}

      <div>
        <h4 className="mb-2 text-sm font-bold text-slate-800">Lịch sử ca</h4>
        {assignmentQuery.isPending ? (
          <Skeleton className="h-28 w-full" />
        ) : history.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có lịch sử gán ca.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Ca</th><th className="px-3 py-2">Từ</th><th className="px-3 py-2">Đến</th><th className="px-3 py-2">Người gán</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-3 py-2 font-semibold">{assignment.work_shift.code} — {assignment.work_shift.name}</td>
                    <td className="px-3 py-2">{formatDateTime(assignment.effective_from)}</td>
                    <td className="px-3 py-2">{formatDateTime(assignment.effective_to)}</td>
                    <td className="px-3 py-2">{displayUser(assignment.assigned_by_user)}</td>
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
