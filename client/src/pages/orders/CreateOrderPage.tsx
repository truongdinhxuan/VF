import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listAreas } from '../../api/areas.service';
import { getApiErrorMessage } from '../../api/errors';
import { createOrder } from '../../api/orders.service';
import { getShiftOrderSheet } from '../../api/shift-order-sheets.service';
import { listSupplies } from '../../api/supplies.service';
import { InfoButton, SecondaryButton, TextButton, TextErrorButton } from '../../components/common/Button';
import { SupplyProviderSelect } from '../../components/common/SupplyProviderSelect';
import { OrderStackFields } from '../../components/orders/OrderStackFields';
import { SelectSkeleton } from '../../components/common/skeleton';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useCrudResource } from '../../hooks/useCrudResource';
import { useServerLookup } from '../../hooks/useServerLookup';
import { queryKeys } from '../../lib/queryKeys';
import type { AreaOption, SupplyOption } from '../../types/catalog';
import type { CreateOrderInput } from '../../types/orders';

interface CreateOrderForm {
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

const CreateOrderPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const ordersPath = getWorkspacePath(role, 'orders');
  const receivingAreaId = user?.publicData.area_id ?? '';
  const shiftOrderSheetId = searchParams.get('shiftOrderSheetId') ?? '';
  const shiftSheetQuery = useQuery({
    queryKey: queryKeys.shiftOrderSheets.detail(shiftOrderSheetId),
    queryFn: ({ signal }) => getShiftOrderSheet(shiftOrderSheetId, signal),
    enabled: Boolean(shiftOrderSheetId),
  });
  const supplyLoader = useCallback(
    (search: string | undefined, signal: AbortSignal) => listSupplies(
      { page: 1, pageSize: 20, search, isActive: true, isDeleted: false, sortBy: 'code', sortOrder: 'asc' },
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
    queryKey: (search) => queryKeys.supplies.lookup({ search, pageSize: 20, isActive: true, isDeleted: false }),
    errorMessage: 'Không thể tải danh sách vật tư.',
  });
  const areaResource = useCrudResource<AreaOption>(
    loadAreas,
    'Không thể tải danh sách area.',
    queryKeys.areas.lookup({ pageSize: 100, isActive: true }),
  );
  const areas = areaResource.items;
  const sourceArea = areas.find((area) => area.code === ORDER_SOURCE_AREA_CODE);
  const receivingArea = user?.publicData.area ?? areas.find((area) => area.id === receivingAreaId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderForm>({
    defaultValues: { note: '', order_list: [emptyItem()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'order_list' });
  const orderItems = useWatch({ control, name: 'order_list' });
  const previousSourceAreaId = useRef('');

  const resetStackFields = useCallback((index: number) => {
    setValue(`order_list.${index}.set_per_qty`, undefined, { shouldValidate: false });
    setValue(`order_list.${index}.requested_stack_quantity`, undefined, { shouldValidate: false });
    setValue(`order_list.${index}.requested_total_set_quantity`, undefined, { shouldValidate: false });
  }, [setValue]);

  useEffect(() => {
    const nextAreaId = sourceArea?.id ?? '';
    if (previousSourceAreaId.current
        && nextAreaId
        && previousSourceAreaId.current !== nextAreaId) {
      fields.forEach((_, index) => resetStackFields(index));
    }
    previousSourceAreaId.current = nextAreaId;
  }, [fields, resetStackFields, sourceArea?.id]);

  const changeSupply = (index: number, supplyId: string) => {
    const supply = supplies.find((item) => item.id === supplyId);
    setValue(`order_list.${index}.supply_id`, supplyId, { shouldValidate: true });
    setValue(`order_list.${index}.provider_id`, '', { shouldValidate: false });
    setValue(`order_list.${index}.unit_id`, supply?.unit_id ?? '', { shouldValidate: true });
    setValue(`order_list.${index}.quantity_requested`,
      supply?.category?.code === 'KIEN_SAT_TC' ? undefined : 1,
      { shouldValidate: false },
    );
    resetStackFields(index);
  };

  const changeProvider = (index: number, providerId: string) => {
    setValue(`order_list.${index}.provider_id`, providerId, { shouldValidate: true });
    resetStackFields(index);
  };

  const changeSetPerQty = (index: number, value: number | undefined) => {
    const requestedStacks = orderItems[index]?.requested_stack_quantity;
    setValue(`order_list.${index}.set_per_qty`, value, { shouldValidate: true });
    const total = value && requestedStacks ? value * requestedStacks : undefined;
    setValue(`order_list.${index}.requested_total_set_quantity`, total);
    setValue(`order_list.${index}.quantity_requested`, total, { shouldValidate: true });
  };

  const changeRequestedStackQuantity = (index: number, value: number | undefined) => {
    const setPerQty = orderItems[index]?.set_per_qty;
    setValue(`order_list.${index}.requested_stack_quantity`, value, { shouldValidate: true });
    const total = value && setPerQty ? value * setPerQty : undefined;
    setValue(`order_list.${index}.requested_total_set_quantity`, total);
    setValue(`order_list.${index}.quantity_requested`, total, { shouldValidate: true });
  };

  const onSubmit = async (values: CreateOrderForm) => {
    setSubmitError(null);
    if (!receivingAreaId) return setSubmitError('Tài khoản chưa có area_id nên không thể tạo order.');
    if (suppliesLoading || suppliesError || supplies.length === 0) return setSubmitError('Danh sách vật tư chưa sẵn sàng. Vui lòng tải lại trang và thử lại.');
    if (areaResource.loading || areaResource.error || areas.length === 0) return setSubmitError('Danh sách area chưa sẵn sàng. Vui lòng tải lại trang và thử lại.');
    if (!sourceArea) return setSubmitError(`Không tìm thấy Area gửi active có code ${ORDER_SOURCE_AREA_CODE}.`);
    if (!areas.some((area) => area.id === receivingAreaId)) return setSubmitError('Area của tài khoản không còn active hoặc không hợp lệ.');

    const payload: CreateOrderInput = {
      from_area_id: sourceArea.id,
      to_area_id: receivingAreaId,
      ...(shiftOrderSheetId ? { shift_order_sheet_id: shiftOrderSheetId } : {}),
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
    };

    try {
      const order = await createOrder(payload);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
      navigate(`${ordersPath}/${order.id}${shiftOrderSheetId ? `?shiftOrderSheetId=${shiftOrderSheetId}` : ''}`);
    } catch (requestError) {
      setSubmitError(getApiErrorMessage(requestError, 'Không thể tạo order.'));
    }
  };

  const referenceUnavailable = suppliesLoading || areaResource.loading
    || Boolean(suppliesError) || Boolean(areaResource.error)
    || supplies.length === 0 || areas.length === 0 || !sourceArea || !receivingAreaId
    || Boolean(shiftOrderSheetId && (shiftSheetQuery.isPending || shiftSheetQuery.isError || !shiftSheetQuery.data));

  return (
    <section className="space-y-5">
      <div>
        <Link to={ordersPath} className={TextButton}>← Danh sách order</Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Tạo order</h1>
        <p className="mt-1 text-sm text-slate-500">Order được tạo ở trạng thái DRAFT và chưa làm thay đổi tồn kho.</p>
      </div>

      {shiftOrderSheetId && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {shiftSheetQuery.isPending ? (
            <p>Đang kiểm tra Phiếu Order Ca...</p>
          ) : shiftSheetQuery.isError || !shiftSheetQuery.data ? (
            <p role="alert" className="font-semibold">Không thể xác thực Phiếu Order Ca. Không nên tiếp tục tạo Order từ context này.</p>
          ) : (
            <>
              <p className="font-bold">Tạo thêm Order trong Phiếu Order Ca</p>
              <p className="mt-1">
                {shiftSheetQuery.data.area?.name ?? 'Area không xác định'} — {shiftSheetQuery.data.work_shift?.code ?? 'Ca không xác định'} — {shiftSheetQuery.data.work_date}
              </p>
              <p className="mt-1 text-xs text-blue-700">Backend sẽ kiểm tra lại Area, hierarchy, ca và ngày làm việc khi tạo và submit.</p>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Area gửi
            <input value={sourceArea ? `${sourceArea.code} — ${sourceArea.name}` : areaResource.loading ? 'Đang tải Area gửi...' : `${ORDER_SOURCE_AREA_CODE} — Không tìm thấy`} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Area nhận
            <input value={receivingArea ? `${receivingArea.code} — ${receivingArea.name}` : receivingAreaId} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600" />
            {areaResource.error && <span className="text-xs font-normal text-rose-600">{areaResource.error}</span>}
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
            Ghi chú
            <textarea {...register('note')} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold text-slate-900">Vật tư yêu cầu</h2><p className="mt-1 text-xs text-slate-500">Mỗi dòng phải chọn Supply, Provider và có số lượng lớn hơn 0.</p></div>
            <button type="button" onClick={() => append(emptyItem())} className={SecondaryButton}>Thêm dòng</button>
          </div>

          <input type="search" value={supplySearch} onChange={(event) => setSupplySearch(event.target.value)} placeholder="Tìm vật tư trên server..." className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          {suppliesError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{suppliesError}</div>}
          {!suppliesLoading && !suppliesError && supplies.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Không có vật tư active.</div>}

          <div className="mt-4 space-y-3">
            {fields.map((field, index) => {
              const current = orderItems[index] ?? emptyItem();
              const selectedSupply = supplies.find((supply) => supply.id === current.supply_id);
              const isStack = selectedSupply?.category?.code === 'KIEN_SAT_TC';
              return (
                <div key={field.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-6">
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

        {submitError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>}
        <div className="flex justify-end gap-3">
          <Link to={ordersPath} className={SecondaryButton}>Hủy</Link>
          <button type="submit" disabled={isSubmitting || referenceUnavailable} className={InfoButton}>{isSubmitting ? 'Đang tạo...' : 'Lưu DRAFT'}</button>
        </div>
      </form>
    </section>
  );
};

export default CreateOrderPage;
