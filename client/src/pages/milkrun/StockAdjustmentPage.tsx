import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { getApiErrorMessage } from '../../api/errors';
import {
  listMilkrunAdjustmentReasons,
  listMilkrunRacks,
  listMilkrunStockTransactionTypes,
} from '../../api/milkrun-master-data.service';
import {
  createMilkrunStockAdjustment,
  listMilkrunStockBalances,
} from '../../api/milkrun-stock.service';
import {
  ConfirmDialog,
  CrudFeedbackToast,
  CrudPageHeader,
  FieldError,
  inputClassName,
  labelClassName,
} from '../../components/crud/CrudPrimitives';
import { InfoButton } from '../../components/common/Button';
import { SelectSkeleton } from '../../components/common/skeleton';
import type { CrudFeedback } from '../../hooks/useCrudResource';
import { queryKeys } from '../../lib/queryKeys';
import type { CreateMilkrunStockAdjustmentInput } from '../../types/milkrun';

interface AdjustmentFormValues {
  rack_id: string;
  transaction_type_id: string;
  adjustment_reason_id: string;
  quantity: number;
  reason_note: string;
}

const StockAdjustmentPage = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const [confirmation, setConfirmation] = useState<CreateMilkrunStockAdjustmentInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AdjustmentFormValues>({
    defaultValues: {
      rack_id: '',
      transaction_type_id: '',
      adjustment_reason_id: '',
      quantity: 1,
      reason_note: '',
    },
  });
  const rackId = useWatch({ control, name: 'rack_id' });
  const typeId = useWatch({ control, name: 'transaction_type_id' });
  const quantity = Number(useWatch({ control, name: 'quantity' })) || 0;

  const racksQuery = useQuery({
    queryKey: queryKeys.milkrunRacks.lookup({ pageSize: 100, active: true }),
    queryFn: ({ signal }) => listMilkrunRacks(
      { page: 1, pageSize: 100, isActive: true, isDeleted: false },
      signal,
    ),
    staleTime: 5 * 60 * 1000,
  });
  const typesQuery = useQuery({
    queryKey: queryKeys.milkrunStockTransactionTypes.lookup({ adjustment: true }),
    queryFn: ({ signal }) => listMilkrunStockTransactionTypes(
      { page: 1, pageSize: 100, isActive: true, isDeleted: false },
      signal,
    ),
    staleTime: 5 * 60 * 1000,
  });
  const reasonsQuery = useQuery({
    queryKey: queryKeys.milkrunAdjustmentReasons.lookup({ pageSize: 100, active: true }),
    queryFn: ({ signal }) => listMilkrunAdjustmentReasons(
      { page: 1, pageSize: 100, isActive: true, isDeleted: false },
      signal,
    ),
    staleTime: 5 * 60 * 1000,
  });
  const balanceQuery = useQuery({
    queryKey: queryKeys.milkrunStockBalances.lookup({ rackId }),
    queryFn: ({ signal }) => listMilkrunStockBalances(
      { page: 1, pageSize: 1, rackId, sortBy: 'updated_at', sortOrder: 'desc' },
      signal,
    ),
    enabled: Boolean(rackId),
  });

  const adjustmentTypes = useMemo(
    () => (typesQuery.data?.data ?? []).filter((type) =>
      type.code === 'ADJUSTMENT_IN' || type.code === 'ADJUSTMENT_OUT'),
    [typesQuery.data?.data],
  );
  const selectedType = adjustmentTypes.find((type) => type.id === typeId);
  const currentQuantity = Number(balanceQuery.data?.data[0]?.quantity ?? 0);
  const signedQuantity = selectedType?.effect === 'DECREASE' ? -quantity : quantity;
  const afterQuantity = currentQuantity + signedQuantity;
  const lookupError = racksQuery.isError || typesQuery.isError || reasonsQuery.isError;

  const prepareSubmit = (values: AdjustmentFormValues) => {
    setFeedback(null);
    const payload: CreateMilkrunStockAdjustmentInput = {
      rack_id: values.rack_id,
      transaction_type_id: values.transaction_type_id,
      adjustment_reason_id: values.adjustment_reason_id,
      quantity: Number(values.quantity),
      reason_note: values.reason_note.trim() || null,
    };
    setConfirmation(payload);
  };

  const submit = async () => {
    if (!confirmation) return;
    setSubmitting(true);
    try {
      await createMilkrunStockAdjustment(confirmation);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.milkrunStockBalances.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.milkrunStockTransactions.all }),
      ]);
      setFeedback({ type: 'success', message: 'Đã tạo giao dịch điều chỉnh tồn.' });
      setConfirmation(null);
      reset();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể điều chỉnh tồn Rack.'),
      });
      setConfirmation(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <CrudPageHeader
        title="Cân / điều chỉnh tồn"
        description="Điều chỉnh ngoài Trip bắt buộc có lý do và luôn tạo StockTransaction mới."
      />
      <CrudFeedbackToast feedback={feedback} onClose={() => setFeedback(null)} />
      {lookupError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Không thể tải Rack, loại giao dịch hoặc lý do điều chỉnh. Vui lòng thử lại.
        </div>
      )}
      <form onSubmit={handleSubmit(prepareSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className={labelClassName}>
            Rack *
            {racksQuery.isPending ? <SelectSkeleton label="Đang tải Rack" /> : (
              <select {...register('rack_id', { required: 'Vui lòng chọn Rack.' })} className={inputClassName}>
                <option value="">Chọn Rack</option>
                {(racksQuery.data?.data ?? []).map((rack) => (
                  <option key={rack.id} value={rack.id}>{rack.code} — {rack.name}</option>
                ))}
              </select>
            )}
            <FieldError message={errors.rack_id?.message} />
          </label>
          <label className={labelClassName}>
            Tồn hiện tại
            <input
              readOnly
              value={rackId ? (balanceQuery.isPending ? 'Đang tải...' : currentQuantity) : 'Chọn Rack trước'}
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            Loại điều chỉnh *
            {typesQuery.isPending ? <SelectSkeleton label="Đang tải loại giao dịch" /> : (
              <select {...register('transaction_type_id', { required: 'Vui lòng chọn loại điều chỉnh.' })} className={inputClassName}>
                <option value="">Chọn ADJUSTMENT_IN / ADJUSTMENT_OUT</option>
                {adjustmentTypes.map((type) => <option key={type.id} value={type.id}>{type.code} — {type.name}</option>)}
              </select>
            )}
            <FieldError message={errors.transaction_type_id?.message} />
          </label>
          <label className={labelClassName}>
            Số lượng *
            <input
              type="number"
              step="any"
              min="0.000001"
              {...register('quantity', {
                valueAsNumber: true,
                required: 'Vui lòng nhập số lượng.',
                min: { value: 0.000001, message: 'Số lượng phải lớn hơn 0.' },
              })}
              className={inputClassName}
            />
            <FieldError message={errors.quantity?.message} />
          </label>
          <label className={labelClassName}>
            Lý do điều chỉnh *
            {reasonsQuery.isPending ? <SelectSkeleton label="Đang tải lý do" /> : (
              <select {...register('adjustment_reason_id', { required: 'Vui lòng chọn lý do.' })} className={inputClassName}>
                <option value="">Chọn lý do</option>
                {(reasonsQuery.data?.data ?? []).map((reason) => (
                  <option key={reason.id} value={reason.id}>{reason.code} — {reason.name}</option>
                ))}
              </select>
            )}
            <FieldError message={errors.adjustment_reason_id?.message} />
          </label>
          <label className={labelClassName}>
            Ghi chú lý do
            <textarea {...register('reason_note')} rows={3} className={inputClassName} />
          </label>
          <button
            type="submit"
            disabled={submitting || lookupError || balanceQuery.isFetching || afterQuantity < 0}
            className={InfoButton}
          >
            Xác nhận điều chỉnh
          </button>
          {afterQuantity < 0 && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              Không thể giảm vượt quá tồn hiện tại.
            </p>
          )}
        </div>
        <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-slate-900">Preview</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt>Tồn hiện tại</dt><dd className="font-semibold">{currentQuantity.toLocaleString('vi-VN')}</dd></div>
            <div className="flex justify-between gap-4"><dt>Điều chỉnh</dt><dd className="font-semibold">{signedQuantity > 0 ? '+' : ''}{signedQuantity.toLocaleString('vi-VN')}</dd></div>
            <div className="flex justify-between gap-4 border-t border-blue-200 pt-3"><dt>Tồn sau</dt><dd className={`font-bold ${afterQuantity < 0 ? 'text-rose-600' : 'text-blue-700'}`}>{afterQuantity.toLocaleString('vi-VN')}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-slate-600">
            Preview chỉ hỗ trợ người dùng kiểm tra. Backend sẽ đọc khóa balance và tính lại tồn trước/sau trong transaction.
          </p>
        </aside>
      </form>
      {confirmation && (
        <ConfirmDialog
          title="Xác nhận điều chỉnh tồn?"
          message={`Hệ thống sẽ tạo giao dịch ${selectedType?.code ?? ''} với số lượng ${confirmation.quantity}. Giao dịch sau khi tạo không thể sửa hoặc xóa.`}
          confirmLabel="Xác nhận"
          busy={submitting}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void submit()}
        />
      )}
    </section>
  );
};

export default StockAdjustmentPage;
