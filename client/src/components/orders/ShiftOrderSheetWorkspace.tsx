import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { exportShiftOrderSheet } from '../../api/shift-order-sheets.service';
import { getApiErrorMessage } from '../../api/errors';
import { PERMISSION_CODE } from '../../constants/permissions';
import { getWorkspacePath } from '../../constants/workspaces';
import { ORDER_READ_PERMISSIONS } from '../../constants/workspaceNavigation';
import { useAuth } from '../../context/AuthContext';
import { useCrudOffcanvas } from '../../hooks/useCrudOffcanvas';
import type { CrudFeedback } from '../../hooks/useCrudResource';
import { queryKeys } from '../../lib/queryKeys';
import type { OrderStatus } from '../../types/orders';
import type {
  ShiftOrderSheetCreateContext,
  ShiftOrderSheetDetail,
  ShiftOrderSheetOrderItem,
} from '../../types/shift-order-sheets';
import { InfoButton, SecondaryButton, TextButton } from '../common/Button';
import { CrudFeedbackToast } from '../crud/CrudPrimitives';
import { DrawerFormFooter } from '../offcanvas';
import { CreateOrderForm, type CreateOrderFormState } from './CreateOrderForm';
import { OrderStatusBadge } from './OrderStatusBadge';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const INITIAL_CREATE_STATE: CreateOrderFormState = {
  stage: 'editing',
  draftOrder: null,
  isDirty: false,
  isBusy: false,
};

const formatDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: BUSINESS_TIME_ZONE,
}).format(new Date(`${value}T00:00:00+07:00`));

const formatDateTime = (value: string | null | undefined): string => value
  ? new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value))
  : '—';

const shiftLabel = (context: ShiftOrderSheetCreateContext): string => {
  const label = context.work_shift?.name || context.work_shift?.code || 'không xác định';
  return label.replace(/^ca\s+/i, '').trim() || context.work_shift?.code || 'không xác định';
};

interface MaterialRow {
  item: ShiftOrderSheetOrderItem;
  order: ShiftOrderSheetDetail['orders'][number];
}

export interface ShiftOrderSheetWorkspaceProps {
  context: ShiftOrderSheetCreateContext;
  sheet: ShiftOrderSheetDetail | null;
  mode: 'current' | 'history' | 'detail';
  onShowHistory?: () => void;
  onBackCurrent?: () => void;
}

export const ShiftOrderSheetWorkspace = ({
  context,
  sheet,
  mode,
  onShowHistory,
  onBackCurrent,
}: ShiftOrderSheetWorkspaceProps) => {
  const queryClient = useQueryClient();
  const { role, hasPermission, hasAnyPermission } = useAuth();
  const {
    openCrud,
    openConfirm,
    updatePrimary,
    requestClosePrimary,
    closePrimary,
  } = useCrudOffcanvas();
  const ordersPath = getWorkspacePath(role, 'orders');
  const [createDrawer, setCreateDrawer] = useState<{ formId: string; formKey: string } | null>(null);
  const [createState, setCreateState] = useState<CreateOrderFormState>(INITIAL_CREATE_STATE);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const createSequence = useRef(0);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const allowCreate = mode === 'current' && hasPermission(PERMISSION_CODE.SUPPLY_ORDER_CREATE);
  const sheetId = sheet?.id ?? null;

  const createContext = useMemo<ShiftOrderSheetCreateContext>(() => ({
    ...context,
    id: sheetId ?? context.id,
    leader: sheet?.leader ?? context.leader ?? null,
  }), [context, sheet?.leader, sheetId]);

  const rows = useMemo<MaterialRow[]>(() => (sheet?.orders ?? [])
    .flatMap((order) => order.order_items.map((item) => ({ item, order })))
    .sort((left, right) => {
      const leftTime = left.order.submitted_at ?? left.order.created_at;
      const rightTime = right.order.submitted_at ?? right.order.created_at;
      const time = rightTime.localeCompare(leftTime);
      return time || right.item.created_at.localeCompare(left.item.created_at)
        || right.item.id.localeCompare(left.item.id);
    }), [sheet]);

  const exportMutation = useMutation({
    mutationFn: () => exportShiftOrderSheet(sheet!.id),
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

  const resetCreateDrawer = useCallback(() => {
    setCreateDrawer(null);
    setCreateState(INITIAL_CREATE_STATE);
  }, []);

  const handleCreateSuccess = useCallback(async () => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists }),
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftOrderSheets.current }),
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftOrderSheets.lists }),
    ];
    if (sheetId) {
      invalidations.push(queryClient.invalidateQueries({
        queryKey: queryKeys.shiftOrderSheets.detail(sheetId),
      }));
    }
    await Promise.allSettled(invalidations);
    setFeedback({ type: 'success', message: 'Order đã được gửi thành công.' });
    closePrimary();
  }, [closePrimary, queryClient, sheetId]);

  const requestPersistedDraftClose = useCallback((): boolean => {
    if (createState.stage !== 'submit-failed' || !createState.draftOrder) return true;
    openConfirm({
      title: 'Order nháp chưa được gửi',
      description: `Order ${createState.draftOrder.code} đã được lưu ở trạng thái DRAFT. Đóng drawer sẽ không xóa Order này.`,
      confirmLabel: 'Đóng',
      cancelLabel: 'Tiếp tục xử lý',
      variant: 'warning',
      onConfirm: () => {
        closePrimary();
        return false;
      },
    });
    return false;
  }, [closePrimary, createState.draftOrder, createState.stage, openConfirm]);

  const renderCreateContent = useCallback((current: { formId: string; formKey: string }): ReactNode => (
    <CreateOrderForm
      key={current.formKey}
      formId={current.formId}
      mode="shift-sheet-submit"
      sheetContext={createContext}
      compact
      initialFocusRef={initialFocusRef}
      onStateChange={setCreateState}
      onSuccess={handleCreateSuccess}
    />
  ), [createContext, handleCreateSuccess]);

  const renderCreateFooter = useCallback((
    current: { formId: string; formKey: string },
    state: CreateOrderFormState,
  ): ReactNode => {
    const retrying = state.stage === 'submit-failed';
    const submittingLabel = state.stage === 'creating-draft'
      ? 'Đang tạo Order...'
      : 'Đang gửi Order...';
    const draftLink = state.draftOrder
      ? `${ordersPath}/${state.draftOrder.id}${sheetId ? `?shiftOrderSheetId=${sheetId}` : ''}`
      : null;
    return (
      <DrawerFormFooter
        cancelLabel={retrying ? 'Đóng' : 'Hủy'}
        submitLabel={retrying ? 'Thử gửi lại' : 'Gửi Order'}
        submittingLabel={submittingLabel}
        isSubmitting={state.isBusy}
        formId={current.formId}
        onCancel={() => requestClosePrimary('cancel')}
        secondaryAction={draftLink ? (
          <Link to={draftLink} onClick={() => closePrimary()} className={`${SecondaryButton} min-h-11 w-full sm:w-auto`}>
            Mở Order nháp
          </Link>
        ) : undefined}
      />
    );
  }, [closePrimary, ordersPath, requestClosePrimary, sheetId]);

  useEffect(() => {
    if (!createDrawer) return;
    updatePrimary({
      title: 'Thêm Order',
      description: 'Area, ca và ngày làm việc đã được khóa theo Phiếu Order Ca hiện tại.',
      content: renderCreateContent(createDrawer),
      footer: renderCreateFooter(createDrawer, createState),
      size: 'lg',
      isDirty: createState.isDirty,
      isBusy: createState.isBusy,
      preventCloseWhileBusy: true,
      initialFocusRef,
      onBeforeClose: requestPersistedDraftClose,
    });
  }, [
    createDrawer,
    createState,
    renderCreateContent,
    renderCreateFooter,
    requestPersistedDraftClose,
    updatePrimary,
  ]);

  const openCreateOrder = (event: MouseEvent<HTMLButtonElement>) => {
    createSequence.current += 1;
    const next = {
      formId: `shift-order-create-form-${createSequence.current}`,
      formKey: `${sheet?.id ?? `${context.area_id}-${context.work_shift_id}-${context.work_date}`}-${createSequence.current}`,
    };
    setFeedback(null);
    setCreateState(INITIAL_CREATE_STATE);
    setCreateDrawer(next);
    openCrud({
      mode: 'create',
      title: 'Thêm Order',
      description: 'Area, ca và ngày làm việc đã được khóa theo Phiếu Order Ca hiện tại.',
      content: renderCreateContent(next),
      footer: renderCreateFooter(next, INITIAL_CREATE_STATE),
      size: 'lg',
      isDirty: false,
      isBusy: false,
      preventCloseWhileBusy: true,
      initialFocusRef,
      triggerElement: event.currentTarget,
      onBeforeClose: () => true,
      onClosed: resetCreateDrawer,
    });
  };

  const titlePrefix = mode === 'history' ? 'Lịch sử — ' : '';
  const leaderName = sheet?.leader
    ? `${sheet.leader.first_name} ${sheet.leader.last_name}`.trim()
    : null;

  return (
    <section className="space-y-5">
      <CrudFeedbackToast feedback={feedback} onClose={() => setFeedback(null)} />
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {mode === 'history' && (
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Lịch sử</p>
            )}
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {titlePrefix}Phiếu order ca {shiftLabel(context)} ngày {formatDate(context.work_date)}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Khu vực: <span className="font-semibold text-slate-900">{context.area?.name ?? 'Không xác định'}</span>
              {context.area?.code && <span className="ml-1 text-slate-400">({context.area.code})</span>}
            </p>
            {leaderName && <p className="mt-1 text-xs text-slate-500">Tổ trưởng: {leaderName}</p>}
          </div>
          <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:flex-wrap lg:justify-end">
            {allowCreate && (
              <button type="button" onClick={openCreateOrder} className={`${InfoButton} w-full min-[360px]:w-auto`}>
                + Thêm Order
              </button>
            )}
            {mode === 'current' && onShowHistory && (
              <button type="button" onClick={onShowHistory} className={`${SecondaryButton} w-full min-[360px]:w-auto`}>
                Lịch sử phiếu order ca
              </button>
            )}
            {mode === 'history' && onBackCurrent && (
              <button type="button" onClick={onBackCurrent} className={`${SecondaryButton} w-full min-[360px]:w-auto`}>
                ← Quay lại phiếu hiện tại
              </button>
            )}
            {sheet && hasAnyPermission(ORDER_READ_PERMISSIONS) && (
              <button
                type="button"
                className={`${SecondaryButton} w-full min-[360px]:w-auto`}
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate()}
              >
                {exportMutation.isPending ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            )}
          </div>
        </div>
      </header>

      {exportMutation.isError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {getApiErrorMessage(exportMutation.error, 'Không thể tạo file Excel. Vui lòng thử lại.')}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="font-bold text-slate-900">Các mã đang Order</h2>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} mã vật tư trong {sheet?.orders.length ?? 0} Order
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-6">
            <p className="text-sm font-semibold text-slate-700">Ca này chưa có Order.</p>
            {allowCreate && (
              <p className="mt-2 text-sm text-slate-500">Chọn “+ Thêm Order” để tạo Order đầu tiên cho ca hiện tại.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã vật tư</th>
                  <th className="px-4 py-3">Mô tả</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">SL yêu cầu</th>
                  <th className="px-4 py-3">Đơn vị</th>
                  <th className="px-4 py-3">Stack</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Người tạo</th>
                  <th className="px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ item, order }) => {
                  const requester = order.requester
                    ? `${order.requester.first_name} ${order.requester.last_name}`.trim()
                    : 'Không xác định';
                  const status = (order.status_lookup?.code ?? order.status) as OrderStatus;
                  const stack = item.requested_stack_quantity && item.set_per_qty
                    ? `${item.requested_stack_quantity} × ${item.set_per_qty}`
                    : '—';
                  return (
                    <tr key={item.id} className="align-top hover:bg-slate-50/80">
                      <td className="px-4 py-4 font-semibold text-slate-900">{item.supply?.code ?? '—'}</td>
                      <td className="max-w-64 whitespace-normal px-4 py-4">{item.supply?.description ?? '—'}</td>
                      <td className="px-4 py-4">{item.provider ? `${item.provider.code} — ${item.provider.name}` : '—'}</td>
                      <td className="px-4 py-4 tabular-nums">{item.quantity_requested}</td>
                      <td className="px-4 py-4">{item.unit?.symbol ?? item.unit?.code ?? '—'}</td>
                      <td className="px-4 py-4 tabular-nums">{stack}</td>
                      <td className="px-4 py-4"><Link to={`${ordersPath}/${order.id}`} className={TextButton}>{order.code}</Link></td>
                      <td className="px-4 py-4"><OrderStatusBadge status={status} /></td>
                      <td className="px-4 py-4">{requester}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(order.submitted_at ?? order.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
