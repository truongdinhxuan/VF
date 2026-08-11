import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  createMilkrunTrip,
  listMilkrunRacks,
  listMilkrunShops,
  listMilkrunTripTypes,
} from '../../api/milkrun-trips.service';
import { getApiErrorMessage } from '../../api/errors';
import { InfoButton, SecondaryButton, TextErrorButton, TextButton } from '../../components/common/Button';
import { SelectSkeleton } from '../../components/common/skeleton';
import { getWorkspacePath } from '../../constants/workspaces';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { queryKeys } from '../../lib/queryKeys';
import type { CreateMilkrunTripInput } from '../../types/milkrun';

interface TripFormValues {
  shop_id: string;
  trip_type_id: string;
  attachment_url: string;
  note: string;
  items: Array<{ rack_id: string; quantity: number; note: string }>;
}

const emptyItem = () => ({ rack_id: '', quantity: 1, note: '' });
const selectClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

const CreateTripPage = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tripsPath = getWorkspacePath(role, 'milkrun/trips');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rackSearchInput, setRackSearchInput] = useState('');
  const rackSearch = useDebounce(rackSearchInput, 400).trim();
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<TripFormValues>({
    defaultValues: { shop_id: '', trip_type_id: '', attachment_url: '', note: '', items: [emptyItem()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const shopsQuery = useQuery({
    queryKey: queryKeys.milkrunShops.lookup({ pageSize: 100 }),
    queryFn: ({ signal }) => listMilkrunShops({ page: 1, pageSize: 100, isActive: true, isDeleted: false }, signal),
    staleTime: 5 * 60 * 1000,
  });
  const tripTypesQuery = useQuery({
    queryKey: queryKeys.milkrunTripTypes.lookup({ pageSize: 100 }),
    queryFn: ({ signal }) => listMilkrunTripTypes({ page: 1, pageSize: 100, isActive: true, isDeleted: false }, signal),
    staleTime: 5 * 60 * 1000,
  });
  const racksQuery = useQuery({
    queryKey: queryKeys.milkrunRacks.lookup({ pageSize: 100, search: rackSearch }),
    queryFn: ({ signal }) => listMilkrunRacks({ page: 1, pageSize: 100, search: rackSearch || undefined, isActive: true, isDeleted: false }, signal),
    staleTime: 60 * 1000,
  });

  const onSubmit = async (values: TripFormValues) => {
    setSubmitError(null);
    const payload: CreateMilkrunTripInput = {
      shop_id: values.shop_id,
      trip_type_id: values.trip_type_id,
      attachment_url: values.attachment_url.trim() || null,
      note: values.note.trim() || null,
      items: values.items.map((item) => ({
        rack_id: item.rack_id,
        quantity: Number(item.quantity),
        note: item.note.trim() || null,
      })),
    };
    try {
      const trip = await createMilkrunTrip(payload);
      await queryClient.invalidateQueries({ queryKey: queryKeys.milkrunTrips.lists });
      navigate(`${tripsPath}/${trip.id}`);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể tạo Milkrun Trip.'));
    }
  };

  const lookupError = shopsQuery.error || tripTypesQuery.error || racksQuery.error;

  return (
    <section className="space-y-5">
      <div>
        <Link to={tripsPath} className={TextButton}>← Danh sách Trip</Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Tạo Milkrun Trip</h1>
        <p className="mt-1 text-sm text-slate-500">Driver lấy từ tài khoản đăng nhập; Area luôn là EDC Logistics.</p>
      </div>

      {lookupError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Không thể tải danh mục Shop, Trip Type hoặc Rack. Vui lòng thử lại.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Shop
            {shopsQuery.isPending ? <SelectSkeleton label="Đang tải Shop" /> : (
              <select {...register('shop_id', { required: 'Chọn Shop.' })} className={selectClassName}>
                <option value="">Chọn Shop</option>
                {(shopsQuery.data?.data ?? []).map((shop) => <option key={shop.id} value={shop.id}>{shop.code} — {shop.name}</option>)}
              </select>
            )}
            {errors.shop_id && <span className="block text-xs font-normal text-rose-600">{errors.shop_id.message}</span>}
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Trip Type
            {tripTypesQuery.isPending ? <SelectSkeleton label="Đang tải Trip Type" /> : (
              <select {...register('trip_type_id', { required: 'Chọn Trip Type.' })} className={selectClassName}>
                <option value="">Chọn Trip Type</option>
                {(tripTypesQuery.data?.data ?? []).map((type) => <option key={type.id} value={type.id}>{type.code} — {type.name}</option>)}
              </select>
            )}
            {errors.trip_type_id && <span className="block text-xs font-normal text-rose-600">{errors.trip_type_id.message}</span>}
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
            Attachment URL
            <input {...register('attachment_url')} className={selectClassName} placeholder="https://..." />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
            Ghi chú
            <textarea {...register('note')} rows={3} className={selectClassName} />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold text-slate-900">Trip Items</h2><p className="text-sm text-slate-500">Mỗi dòng cần Rack và quantity lớn hơn 0.</p></div>
            <button type="button" onClick={() => append(emptyItem())} className={SecondaryButton}>Thêm Rack</button>
          </div>
          <input
            type="search"
            value={rackSearchInput}
            onChange={(event) => setRackSearchInput(event.target.value)}
            placeholder="Tìm Rack trên server..."
            className={`${selectClassName} mt-4`}
          />
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[2fr_1fr_2fr_auto]">
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rack
                  {racksQuery.isPending ? <SelectSkeleton label="Đang tải Rack" /> : (
                    <select {...register(`items.${index}.rack_id`, { required: 'Chọn Rack.' })} className={selectClassName}>
                      <option value="">Chọn Rack</option>
                      {(racksQuery.data?.data ?? []).map((rack) => <option key={rack.id} value={rack.id}>{rack.code} — {rack.name}</option>)}
                    </select>
                  )}
                  {errors.items?.[index]?.rack_id && <span className="block normal-case text-rose-600">{errors.items[index]?.rack_id?.message}</span>}
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Quantity
                  <input type="number" step="any" min="0.000001" {...register(`items.${index}.quantity`, { valueAsNumber: true, min: { value: 0.000001, message: 'Phải lớn hơn 0.' } })} className={selectClassName} />
                  {errors.items?.[index]?.quantity && <span className="block normal-case text-rose-600">{errors.items[index]?.quantity?.message}</span>}
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ghi chú
                  <input {...register(`items.${index}.note`)} className={selectClassName} />
                </label>
                <button type="button" disabled={fields.length === 1} onClick={() => remove(index)} className={`${TextErrorButton} self-end`}>Xóa</button>
              </div>
            ))}
          </div>
        </div>

        {submitError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>}
        <div className="flex justify-end gap-3">
          <Link to={tripsPath} className={SecondaryButton}>Hủy</Link>
          <button type="submit" disabled={isSubmitting || Boolean(lookupError)} className={InfoButton}>
            {isSubmitting ? 'Đang tạo...' : 'Tạo Trip'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CreateTripPage;
