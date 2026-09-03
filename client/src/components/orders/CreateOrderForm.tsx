import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { listAreas } from '../../api/areas.service';
import { getApiErrorMessage } from '../../api/errors';
import { createOrder, submitOrder } from '../../api/orders.service';
import { listSupplies } from '../../api/supplies.service';
import { useAuth } from '../../context/AuthContext';
import { useCrudResource } from '../../hooks/useCrudResource';
import { useServerLookup } from '../../hooks/useServerLookup';
import { queryKeys } from '../../lib/queryKeys';
import type { AreaOption, SupplyOption } from '../../types/catalog';
import type { CreateOrderInput, Order } from '../../types/orders';
import type { ShiftOrderSheetDetail } from '../../types/shift-order-sheets';
import { InfoButton, SecondaryButton, TextErrorButton } from '../common/Button';
import { SelectSkeleton } from '../common/skeleton';
import { SupplyProviderSelect } from '../common/SupplyProviderSelect';
import {
  createAndSubmitOrder,
  DraftSubmitError,
  type CreateOrderStage,
} from './createOrderOrchestration';
import { OrderStackFields } from './OrderStackFields';

interface CreateOrderFormValues {
  note: string;
  order_list: Array<{
    supply_id: string;
    provider_id: string;
    unit_id: string;
    quantity_requested?: number;
    set_per_qty?: number;
    requested_stack_quantity?: number;
    requested_total_set_quantity?: number;
    note: string;
  }>;
}

export interface CreateOrderFormState {
  stage: CreateOrderStage;
  draftOrder: Order | null;
  isDirty: boolean;
  isBusy: boolean;
}

interface CreateOrderFormProps {
  formId: string;
  mode?: 'draft-only' | 'shift-sheet-submit';
  sheetContext?: ShiftOrderSheetDetail | null;
  compact?: boolean;
  showInlineActions?: boolean;
  initialFocusRef?: RefObject<HTMLInputElement | null>;
  onCancel?: () => void;
  onSuccess: (order: Order) => void | Promise<void>;
  onStateChange?: (state: CreateOrderFormState) => void;
}

const ORDER_SOURCE_AREA_CODE = 'VTDG';

const emptyItem = () => ({
  supply_id: '',
  provider_id: '',
  unit_id: '',
  quantity_requested: 1,
  set_per_qty: undefined,
  requested_stack_quantity: undefined,
  requested_total_set_quantity: undefined,
  note: '',
});

const loadAreas = async (signal: AbortSignal) =>
  (await listAreas(
    { page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' },
    signal,
  )).data;

const formatWorkDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};

export const CreateOrderForm = ({
  formId,
  mode = 'draft-only',
  sheetContext = null,
  compact = false,
  showInlineActions = false,
  initialFocusRef,
  onCancel,
  onSuccess,
  onStateChange,
}: CreateOrderFormProps) => {
  const { user } = useAuth();
  const receivingAreaId = user?.publicData.area_id ?? '';
  const supplyLoader = useCallback(
    (search: string | undefined, signal: AbortSignal) => listSupplies(
      {
        page: 1,
        pageSize: 20,
        search,
        isActive: true,
        isDeleted: false,
        sortBy: 'code',
        sortOrder: 'asc',
      },
      signal,
    ),
    [],
  );
  const {
    items: supplies,
    loading: suppliesLoading,
    error: suppliesError,
    search: supplySearch,
    setSearch: setSupplySearch,
  } = useServerLookup<SupplyOption>({
    loader: supplyLoader,
    queryKey: (search) => queryKeys.supplies.lookup({
      search,
      pageSize: 20,
      isActive: true,
      isDeleted: false,
    }),
    errorMessage: 'Không thể tải danh sách vật tư.',
  });
  const areaResource = useCrudResource<AreaOption>(
    loadAreas,
    'Không thể tải danh sách area.',
    queryKeys.areas.lookup({ pageSize: 100, isActive: true }),
  );
  const areas = areaResource.items;
  const sourceArea = areas.find((area) => area.code === ORDER_SOURCE_AREA_CODE);
  const receivingArea = user?.publicData.area
    ?? areas.find((area) => area.id === receivingAreaId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stage, setStage] = useState<CreateOrderStage>('editing');
  const [draftOrder, setDraftOrder] = useState<Order | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CreateOrderFormValues>({
    defaultValues: { note: '', order_list: [emptyItem()] },
    shouldFocusError: true,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'order_list' });
  const orderItems = useWatch({ control, name: 'order_list' });
  const previousSourceAreaId = useRef('');

  const isBusy = stage === 'creating-draft' || stage === 'submitting';
  const formLocked = Boolean(draftOrder);

  useEffect(() => {
    onStateChange?.({
      stage,
      draftOrder,
      isDirty: isDirty && !draftOrder,
      isBusy,
    });
  }, [draftOrder, isBusy, isDirty, onStateChange, stage]);

  const resetStackFields = useCallback((index: number) => {
    setValue(`order_list.${index}.set_per_qty`, undefined, { shouldValidate: false });
    setValue(`order_list.${index}.requested_stack_quantity`, undefined, { shouldValidate: false });
    setValue(`order_list.${index}.requested_total_set_quantity`, undefined, { shouldValidate: false });
  }, [setValue]);

  useEffect(() => {
    const nextAreaId = sourceArea?.id ?? '';
    if (
      previousSourceAreaId.current
      && nextAreaId
      && previousSourceAreaId.current !== nextAreaId
    ) {
      fields.forEach((_, index) => resetStackFields(index));
    }
    previousSourceAreaId.current = nextAreaId;
  }, [fields, resetStackFields, sourceArea?.id]);

  const changeSupply = (index: number, supplyId: string) => {
    const supply = supplies.find((item) => item.id === supplyId);
    setValue(`order_list.${index}.supply_id`, supplyId, { shouldValidate: true, shouldDirty: true });
    setValue(`order_list.${index}.provider_id`, '', { shouldValidate: false, shouldDirty: true });
    setValue(`order_list.${index}.unit_id`, supply?.unit_id ?? '', { shouldValidate: true, shouldDirty: true });
    setValue(
      `order_list.${index}.quantity_requested`,
      supply?.category?.code === 'KIEN_SAT_TC' ? undefined : 1,
      { shouldValidate: false, shouldDirty: true },
    );
    resetStackFields(index);
  };

  const changeProvider = (index: number, providerId: string) => {
    setValue(`order_list.${index}.provider_id`, providerId, { shouldValidate: true, shouldDirty: true });
    resetStackFields(index);
  };

  const changeSetPerQty = (index: number, value: number | undefined) => {
    const requestedStacks = orderItems[index]?.requested_stack_quantity;
    setValue(`order_list.${index}.set_per_qty`, value, { shouldValidate: true, shouldDirty: true });
    const total = value && requestedStacks ? value * requestedStacks : undefined;
    setValue(`order_list.${index}.requested_total_set_quantity`, total, { shouldDirty: true });
    setValue(`order_list.${index}.quantity_requested`, total, { shouldValidate: true, shouldDirty: true });
  };

  const changeRequestedStackQuantity = (index: number, value: number | undefined) => {
    const setPerQty = orderItems[index]?.set_per_qty;
    setValue(`order_list.${index}.requested_stack_quantity`, value, { shouldValidate: true, shouldDirty: true });
    const total = value && setPerQty ? setPerQty * value : undefined;
    setValue(`order_list.${index}.requested_total_set_quantity`, total, { shouldDirty: true });
    setValue(`order_list.${index}.quantity_requested`, total, { shouldValidate: true, shouldDirty: true });
  };

  const buildPayload = (values: CreateOrderFormValues): CreateOrderInput => ({
    from_area_id: sourceArea!.id,
    to_area_id: receivingAreaId,
    ...(sheetContext ? { shift_order_sheet_id: sheetContext.id } : {}),
    note: values.note.trim() || undefined,
    order_list: values.order_list.map((item) => {
      const supply = supplies.find((candidate) => candidate.id === item.supply_id);
      const isStack = supply?.category?.code === 'KIEN_SAT_TC';
      const setPerQty = Number(item.set_per_qty);
      const requestedStacks = Number(item.requested_stack_quantity);
      const requestedTotal = isStack ? setPerQty * requestedStacks : undefined;
      return {
        supply_id: item.supply_id.trim(),
        provider_id: item.provider_id.trim(),
        unit_id: item.unit_id.trim(),
        quantity_requested: isStack ? requestedTotal! : Number(item.quantity_requested),
        ...(isStack ? {
          set_per_qty: setPerQty,
          requested_stack_quantity: requestedStacks,
          requested_total_set_quantity: requestedTotal,
        } : {}),
        note: item.note.trim() || undefined,
      };
    }),
  });

  const validateReferences = (): string | null => {
    if (!receivingAreaId) return 'Tài khoản chưa có area_id nên không thể tạo order.';
    if (suppliesLoading || suppliesError || supplies.length === 0) {
      return 'Danh sách vật tư chưa sẵn sàng. Vui lòng tải lại và thử lại.';
    }
    if (areaResource.loading || areaResource.error || areas.length === 0) {
      return 'Danh sách area chưa sẵn sàng. Vui lòng tải lại và thử lại.';
    }
    if (!sourceArea) return `Không tìm thấy Area gửi active có code ${ORDER_SOURCE_AREA_CODE}.`;
    if (!areas.some((area) => area.id === receivingAreaId)) {
      return 'Area của tài khoản không còn active hoặc không hợp lệ.';
    }
    if (sheetContext && sheetContext.area_id !== receivingAreaId) {
      return 'Phiếu Order Ca không thuộc Area của tài khoản hiện tại.';
    }
    return null;
  };

  const onSubmit = async (values: CreateOrderFormValues) => {
    if (isBusy) return;
    setSubmitError(null);

    const referenceError = validateReferences();
    if (referenceError) {
      setSubmitError(referenceError);
      return;
    }

    try {
      if (mode === 'draft-only') {
        setStage('creating-draft');
        const created = await createOrder(buildPayload(values));
        setDraftOrder(created);
        setStage('success');
        await onSuccess(created);
        return;
      }

      const submitted = await createAndSubmitOrder({
        draft: draftOrder,
        createDraft: () => createOrder(buildPayload(values)),
        submitDraft: (draft) => submitOrder(draft.id, {
          shift_order_sheet_id: sheetContext!.id,
        }),
        onDraftCreated: setDraftOrder,
        onStageChange: setStage,
      });
      await onSuccess(submitted);
    } catch (requestError) {
      if (requestError instanceof DraftSubmitError) {
        setDraftOrder(requestError.draft);
        setSubmitError(getApiErrorMessage(
          requestError.cause,
          'Không thể gửi Order nháp sang PENDING.',
        ));
      } else {
        setStage('editing');
        setSubmitError(getApiErrorMessage(requestError, 'Không thể tạo Order nháp.'));
      }
    }
  };

  const referenceUnavailable = suppliesLoading
    || areaResource.loading
    || Boolean(suppliesError)
    || Boolean(areaResource.error)
    || supplies.length === 0
    || areas.length === 0
    || !sourceArea
    || !receivingAreaId
    || Boolean(sheetContext && sheetContext.area_id !== receivingAreaId);

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {sheetContext && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Phiếu Order Ca</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-blue-700">Area</dt><dd>{sheetContext.area ? `${sheetContext.area.code} — ${sheetContext.area.name}` : 'Không xác định'}</dd></div>
            <div><dt className="text-xs font-semibold text-blue-700">Ca</dt><dd>{sheetContext.work_shift ? `${sheetContext.work_shift.code} — ${sheetContext.work_shift.name}` : 'Không xác định'}</dd></div>
            <div><dt className="text-xs font-semibold text-blue-700">Ngày làm việc</dt><dd>{formatWorkDate(sheetContext.work_date)}</dd></div>
            <div><dt className="text-xs font-semibold text-blue-700">Tổ trưởng</dt><dd>{sheetContext.leader ? `${sheetContext.leader.first_name} ${sheetContext.leader.last_name}`.trim() : 'Không xác định'}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-blue-700">Context của Phiếu được khóa; backend kiểm tra lại khi tạo và submit.</p>
        </div>
      )}

      {draftOrder && stage === 'submit-failed' && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Order nháp {draftOrder.code} đã được tạo nhưng chưa thể gửi.</p>
          <p className="mt-1">Dữ liệu hiện đã được lưu ở trạng thái DRAFT. Form được khóa để tránh chỉnh sửa không được lưu; hãy thử gửi lại hoặc mở Order nháp.</p>
          {submitError && <p className="mt-2 font-semibold">{submitError}</p>}
        </div>
      )}

      <fieldset disabled={formLocked || isBusy} className="space-y-5 disabled:opacity-75">
        <div className={`grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${compact ? '' : 'md:grid-cols-2 md:p-5'}`}>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Area gửi
            <input value={sourceArea ? `${sourceArea.code} — ${sourceArea.name}` : areaResource.loading ? 'Đang tải Area gửi...' : `${ORDER_SOURCE_AREA_CODE} — Không tìm thấy`} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Area nhận
            <input value={receivingArea ? `${receivingArea.code} — ${receivingArea.name}` : receivingAreaId} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600" />
            {areaResource.error && <span className="text-xs font-normal text-rose-600">{areaResource.error}</span>}
          </label>
          <label className={`space-y-1.5 text-sm font-semibold text-slate-700 ${compact ? '' : 'md:col-span-2'}`}>
            Ghi chú
            <textarea {...register('note')} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Vật tư yêu cầu</h2>
              <p className="mt-1 text-xs text-slate-500">Mỗi dòng phải chọn Supply, Provider và có số lượng lớn hơn 0.</p>
            </div>
            <button type="button" onClick={() => append(emptyItem())} className={SecondaryButton}>Thêm dòng</button>
          </div>

          <input
            ref={initialFocusRef}
            type="search"
            value={supplySearch}
            onChange={(event) => setSupplySearch(event.target.value)}
            placeholder="Tìm vật tư trên server..."
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {suppliesError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{suppliesError}</div>}
          {!suppliesLoading && !suppliesError && supplies.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Không có vật tư active.</div>}

          <div className="mt-4 space-y-3">
            {fields.map((field, index) => {
              const current = orderItems[index] ?? emptyItem();
              const selectedSupply = supplies.find((supply) => supply.id === current.supply_id);
              const isStack = selectedSupply?.category?.code === 'KIEN_SAT_TC';
              return (
                <div key={field.id} className={`grid gap-3 rounded-xl border border-slate-200 p-4 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-6'}`}>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vật tư
                    {suppliesLoading && supplies.length === 0 ? <SelectSkeleton label="Đang tải danh mục vật tư" /> : (
                      <select value={current.supply_id} onChange={(event) => changeSupply(index, event.target.value)} disabled={Boolean(suppliesError) || supplies.length === 0} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100">
                        <option value="">Chọn vật tư</option>
                        {supplies.map((supply) => <option key={supply.id} value={supply.id}>{supply.code}{supply.description ? ` — ${supply.description}` : ''}</option>)}
                      </select>
                    )}
                    <input type="hidden" {...register(`order_list.${index}.supply_id`, { required: 'Chọn vật tư.' })} />
                    {errors.order_list?.[index]?.supply_id && <span className="block normal-case text-rose-600">{errors.order_list[index]?.supply_id?.message}</span>}
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Provider
                    <SupplyProviderSelect
                      supplyId={current.supply_id}
                      value={current.provider_id}
                      onChange={(providerId) => changeProvider(index, providerId)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100"
                      ariaLabel={`Chọn Provider cho dòng ${index + 1}`}
                    />
                    <input type="hidden" {...register(`order_list.${index}.provider_id`, { required: 'Chọn Provider.' })} />
                    {errors.order_list?.[index]?.provider_id && <span className="block normal-case text-rose-600">{errors.order_list[index]?.provider_id?.message}</span>}
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Unit
                    <input value={selectedSupply?.unit ? `${selectedSupply.unit.code} — ${selectedSupply.unit.symbol}` : current.unit_id} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal normal-case text-slate-600" />
                    <input type="hidden" {...register(`order_list.${index}.unit_id`, { required: 'Vật tư chưa có Unit.' })} />
                    {errors.order_list?.[index]?.unit_id && <span className="block normal-case text-rose-600">{errors.order_list[index]?.unit_id?.message}</span>}
                  </label>
                  {isStack ? (
                    <>
                      <input type="hidden" {...register(`order_list.${index}.set_per_qty`, { required: 'Chọn SET/chồng.', min: { value: 0.000001, message: 'Phải lớn hơn 0.' } })} />
                      <input type="hidden" {...register(`order_list.${index}.requested_stack_quantity`, { required: 'Nhập số chồng.', min: { value: 0.000001, message: 'Phải lớn hơn 0.' } })} />
                      <input type="hidden" {...register(`order_list.${index}.requested_total_set_quantity`)} />
                      <input type="hidden" {...register(`order_list.${index}.quantity_requested`, { required: 'Tổng SET chưa hợp lệ.', min: { value: 0.000001, message: 'Phải lớn hơn 0.' } })} />
                      <OrderStackFields
                        compact={compact}
                        supplyId={current.supply_id}
                        providerId={current.provider_id}
                        areaId={sourceArea?.id ?? ''}
                        setPerQty={current.set_per_qty}
                        requestedStackQuantity={current.requested_stack_quantity}
                        onSetPerQtyChange={(value) => changeSetPerQty(index, value)}
                        onRequestedStackQuantityChange={(value) => changeRequestedStackQuantity(index, value)}
                        setPerQtyError={errors.order_list?.[index]?.set_per_qty?.message}
                        requestedStackQuantityError={errors.order_list?.[index]?.requested_stack_quantity?.message}
                      />
                    </>
                  ) : (
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Số lượng
                      <input type="number" step="any" min="0.000001" {...register(`order_list.${index}.quantity_requested`, { valueAsNumber: true, required: 'Nhập số lượng.', min: { value: 0.000001, message: 'Phải lớn hơn 0.' } })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                      {errors.order_list?.[index]?.quantity_requested && <span className="block normal-case text-rose-600">{errors.order_list[index]?.quantity_requested?.message}</span>}
                    </label>
                  )}
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ghi chú dòng
                    <input {...register(`order_list.${index}.note`)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-800" />
                  </label>
                  <button type="button" disabled={fields.length === 1} onClick={() => remove(index)} className={`${TextErrorButton} self-end`}>Xóa</button>
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>

      {submitError && !(draftOrder && stage === 'submit-failed') && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>
      )}

      {showInlineActions && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onCancel && <button type="button" onClick={onCancel} disabled={isBusy} className={`${SecondaryButton} w-full sm:w-auto`}>Hủy</button>}
          <button type="submit" disabled={isBusy || referenceUnavailable} className={`${InfoButton} w-full sm:w-auto`}>
            {isBusy ? 'Đang tạo...' : 'Lưu DRAFT'}
          </button>
        </div>
      )}
    </form>
  );
};
