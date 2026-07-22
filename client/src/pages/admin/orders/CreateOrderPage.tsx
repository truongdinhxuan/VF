import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { listAreas } from "../../../api/areas.service";
import { getApiErrorMessage } from "../../../api/errors";
import { createOrder } from "../../../api/orders.service";
import { listSupplies } from "../../../api/supplies.service";
import { useAuth } from "../../../context/AuthContext";
import { useServerLookup } from "../../../hooks/useServerLookup";
import type { AreaOption, SupplyOption } from "../../../types/catalog";
import type { CreateOrderInput } from "../../../types/orders";

interface CreateOrderForm {
  to_area_id: string;
  note: string;
  order_list: Array<{
    supply_id: string;
    quantity_requested: number;
    note: string;
  }>;
}

const CreateOrderPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fromAreaId = user?.publicData.area_id ?? "";
  const fromAreaName = user?.publicData.area?.name;
  const supplyLoader = useCallback((search: string | undefined, signal: AbortSignal) => listSupplies({ page: 1, pageSize: 20, search, isActive: true, isDeleted: false, sortBy: 'code', sortOrder: 'asc' }, signal), []);
  const {
    items: supplies,
    loading: suppliesLoading,
    error: suppliesError,
    search: supplySearch,
    setSearch: setSupplySearch,
  } = useServerLookup<SupplyOption>({ loader: supplyLoader, errorMessage: 'Không thể tải danh sách vật tư.' });
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderForm>({
    defaultValues: {
      to_area_id: "",
      note: "",
      order_list: [{ supply_id: "", quantity_requested: 1, note: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "order_list" });

  useEffect(() => {
    const controller = new AbortController();
    listAreas({ page: 1, pageSize: 100, isActive: true, sortBy: 'code', sortOrder: 'asc' }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setAreas(response.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setAreasError(getApiErrorMessage(requestError, "Không thể tải danh sách area."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setAreasLoading(false);
      });
    return () => controller.abort();
  }, []);

  const onSubmit = async (values: CreateOrderForm) => {
    setSubmitError(null);
    if (!fromAreaId) {
      setSubmitError("Tài khoản chưa có area_id nên không thể tạo order.");
      return;
    }
    if (suppliesLoading || suppliesError || supplies.length === 0) {
      setSubmitError("Danh sách vật tư chưa sẵn sàng. Vui lòng tải lại trang và thử lại.");
      return;
    }
    if (areasLoading || areasError || areas.length === 0) {
      setSubmitError("Danh sách area chưa sẵn sàng. Vui lòng tải lại trang và thử lại.");
      return;
    }
    if (!areas.some((area) => area.id === values.to_area_id)) {
      setSubmitError("Area nhận không còn active hoặc không hợp lệ.");
      return;
    }
    const payload: CreateOrderInput = {
      from_area_id: fromAreaId,
      to_area_id: values.to_area_id.trim(),
      note: values.note.trim() || undefined,
      order_list: values.order_list.map((item) => ({
        supply_id: item.supply_id.trim(),
        quantity_requested: Number(item.quantity_requested),
        note: item.note.trim() || undefined,
      })),
    };

    try {
      const order = await createOrder(payload);
      navigate(`/admin/orders/${order.id}`);
    } catch (requestError) {
      setSubmitError(getApiErrorMessage(requestError, "Không thể tạo order."));
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <Link to="/admin/orders" className="text-sm font-semibold text-blue-600 hover:underline">← Danh sách order</Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Tạo order</h1>
        <p className="mt-1 text-sm text-slate-500">Order được tạo ở trạng thái DRAFT và chưa làm thay đổi tồn kho.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Area gửi
            <input
              value={fromAreaName ? `${fromAreaName} (${fromAreaId})` : fromAreaId}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600"
            />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Area nhận
            <select
              {...register("to_area_id", { required: "Area nhận là bắt buộc." })}
              disabled={areasLoading || Boolean(areasError) || areas.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                {areasLoading
                  ? "Đang tải areas..."
                  : areasError
                    ? "Không thể tải areas"
                    : areas.length === 0
                      ? "Không có area active"
                      : "Chọn area nhận"}
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.code} — {area.name}</option>
              ))}
            </select>
            {areasLoading && <span className="text-xs font-normal text-slate-500">Đang tải danh sách area...</span>}
            {areasError && <span className="text-xs font-normal text-rose-600">{areasError}</span>}
            {!areasLoading && !areasError && areas.length === 0 && (
              <span className="text-xs font-normal text-amber-700">Không có area active để chọn.</span>
            )}
            {errors.to_area_id && <span className="text-xs text-rose-600">{errors.to_area_id.message}</span>}
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
            Ghi chú
            <textarea
              {...register("note")}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Vật tư yêu cầu</h2>
              <p className="mt-1 text-xs text-slate-500">Số lượng phải lớn hơn 0.</p>
            </div>
            <button
              type="button"
              onClick={() => append({ supply_id: "", quantity_requested: 1, note: "" })}
              className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Thêm dòng
            </button>
          </div>

          {suppliesLoading && <p className="mt-4 text-sm text-slate-500">Đang tải danh mục vật tư...</p>}
          <input type="search" value={supplySearch} onChange={(event) => setSupplySearch(event.target.value)} placeholder="Tìm vật tư trên server..." className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          {suppliesError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {suppliesError}
            </div>
          )}
          {!suppliesLoading && !suppliesError && supplies.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Không có vật tư active. Không sử dụng dữ liệu giả.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[2fr_150px_2fr_auto]">
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vật tư
                  <select
                    {...register(`order_list.${index}.supply_id`, { required: "Chọn vật tư." })}
                    disabled={suppliesLoading || Boolean(suppliesError) || supplies.length === 0}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="">
                      {suppliesLoading
                        ? "Đang tải vật tư..."
                        : suppliesError
                          ? "Không thể tải vật tư"
                          : supplies.length === 0
                            ? "Không có vật tư active"
                            : "Chọn vật tư"}
                    </option>
                    {supplies.map((supply) => (
                      <option key={supply.id} value={supply.id}>{supply.code}{supply.description ? ` — ${supply.description}` : ''}</option>
                    ))}
                  </select>
                  {errors.order_list?.[index]?.supply_id && (
                    <span className="block normal-case text-rose-600">{errors.order_list[index]?.supply_id?.message}</span>
                  )}
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Số lượng
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    {...register(`order_list.${index}.quantity_requested`, {
                      valueAsNumber: true,
                      required: "Nhập số lượng.",
                      min: { value: 0.000001, message: "Phải lớn hơn 0." },
                    })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"
                  />
                  {errors.order_list?.[index]?.quantity_requested && (
                    <span className="block normal-case text-rose-600">{errors.order_list[index]?.quantity_requested?.message}</span>
                  )}
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ghi chú dòng
                  <input
                    {...register(`order_list.${index}.note`)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-800"
                  />
                </label>
                <button
                  type="button"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                  className="self-end rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>

        {submitError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>}

        <div className="flex justify-end gap-3">
          <Link to="/admin/orders" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Hủy
          </Link>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              suppliesLoading ||
              areasLoading ||
              Boolean(suppliesError) ||
              Boolean(areasError) ||
              supplies.length === 0 ||
              areas.length === 0
            }
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Đang tạo..." : "Lưu DRAFT"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CreateOrderPage;
