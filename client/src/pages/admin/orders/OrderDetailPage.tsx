import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../api/errors";
import { listStorageLocations } from "../../../api/storage-locations.service";
import {
  approveOrder,
  cancelOrder,
  completeOrder,
  getOrder,
  issueOrder,
  receiveOrder,
  rejectOrder,
  submitOrder,
  updateOrder,
} from "../../../api/orders.service";
import { OrderStatusBadge } from "../../../components/admin/orders/OrderStatusBadge";
import {
  ORDER_APPROVER_ROLES,
  ORDER_ISSUER_ROLES,
  PACKING_ROLE,
} from "../../../constants/roles";
import { useAuth } from "../../../context/AuthContext";
import { useDebounce } from "../../../hooks/useDebounce";
import type { StorageLocationOption } from "../../../types/catalog";
import type { Order, OrderItem } from "../../../types/orders";

type ActionPanel = "approve" | "reject" | "issue" | "cancel" | null;
type ItemValues = Record<string, { quantity: string; note?: string; storageLocationId?: string }>;

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

const itemRemaining = (item: OrderItem) =>
  Math.max(0, Number(item.quantity_approved ?? 0) - Number(item.quantity_issued ?? 0));

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [panel, setPanel] = useState<ActionPanel>(null);
  const [reason, setReason] = useState("");
  const [itemValues, setItemValues] = useState<ItemValues>({});
  const [editing, setEditing] = useState(false);
  const [storageLocations, setStorageLocations] = useState<StorageLocationOption[]>([]);
  const [storageLocationsLoading, setStorageLocationsLoading] = useState(false);
  const [storageLocationsError, setStorageLocationsError] = useState<string | null>(null);
  const [storageLocationSearch, setStorageLocationSearch] = useState("");
  const debouncedStorageLocationSearch = useDebounce(storageLocationSearch);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getOrder(id)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch((requestError: unknown) => {
        if (active) setLoadError(getApiErrorMessage(requestError, "Không thể tải order."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (panel !== "issue" || !order) return;
    const controller = new AbortController();
    setStorageLocationsLoading(true);
    setStorageLocationsError(null);
    listStorageLocations({ page: 1, pageSize: 20, search: debouncedStorageLocationSearch.trim() || undefined, areaId: order.to_area_id, isActive: true, sortBy: 'code', sortOrder: 'asc' }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setStorageLocations(response.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setStorageLocationsError(getApiErrorMessage(requestError, "Không thể tải danh sách vị trí kho."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setStorageLocationsLoading(false);
      });
    return () => controller.abort();
  }, [debouncedStorageLocationSearch, order, panel]);

  const items = useMemo(() => order?.order_items ?? [], [order]);
  const actorId = user?.publicData.id ?? user?.id;
  const isPackingOwner = Boolean(
    order &&
    role === PACKING_ROLE &&
    actorId === order.requested_by &&
    user?.publicData.area_id === order.from_area_id,
  );
  const isApprover = Boolean(role && ORDER_APPROVER_ROLES.includes(role));
  const isIssuer = Boolean(role && ORDER_ISSUER_ROLES.includes(role));
  const canEdit = Boolean(order && isPackingOwner && ["DRAFT", "PENDING"].includes(order.status));
  const canSubmit = Boolean(order && isPackingOwner && order.status === "DRAFT");
  const canCancel = Boolean(order && isPackingOwner && ["DRAFT", "PENDING"].includes(order.status));
  const canApprove = Boolean(order && isApprover && order.status === "PENDING");
  const canIssue = Boolean(order && isIssuer && ["APPROVED", "PARTIAL_ISSUED"].includes(order.status));
  const canReceive = Boolean(order && isPackingOwner && order.status === "ISSUED");
  const canComplete = Boolean(order && isIssuer && ["ISSUED", "RECEIVED"].includes(order.status));

  const runMutation = async (operation: () => Promise<Order>) => {
    setMutating(true);
    setActionError(null);
    try {
      const updated = await operation();
      setOrder(updated);
      setPanel(null);
      setEditing(false);
      setReason("");
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, "Không thể cập nhật order."));
    } finally {
      setMutating(false);
    }
  };

  const openPanel = (nextPanel: Exclude<ActionPanel, null>) => {
    setActionError(null);
    setReason("");
    setPanel(nextPanel);
    if (nextPanel === "approve") {
      setItemValues(Object.fromEntries(items.map((item) => [item.id, {
        quantity: String(item.quantity_approved ?? item.quantity_requested),
      }])));
    }
    if (nextPanel === "issue") {
      setItemValues(Object.fromEntries(items.map((item) => [item.id, {
        quantity: "",
        storageLocationId: "",
      }])));
    }
  };

  const startEditing = () => {
    setPanel(null);
    setActionError(null);
    setItemValues(Object.fromEntries(items.map((item) => [item.id, {
      quantity: String(item.quantity_requested),
      note: item.note ?? "",
    }])));
    setEditing(true);
  };

  const openIssuePanel = () => {
    if (!order) return;
    openPanel("issue");
    setStorageLocations([]);
    setStorageLocationSearch("");
  };

  const saveItems = () => {
    if (!id || !order) return;
    const invalid = items.some((item) => Number(itemValues[item.id]?.quantity) <= 0);
    if (invalid) {
      setActionError("Số lượng yêu cầu phải lớn hơn 0.");
      return;
    }
    void runMutation(() => updateOrder(id, {
      order_list: items.map((item) => ({
        supply_id: item.supply_id,
        unit_id: item.unit_id,
        quantity_requested: Number(itemValues[item.id].quantity),
        note: itemValues[item.id].note?.trim() || undefined,
      })),
    }));
  };

  const confirmApprove = () => {
    if (!id) return;
    const approvals = items.map((item) => ({
      order_item_id: item.id,
      quantity_approved: Number(itemValues[item.id]?.quantity),
    }));
    const invalid = approvals.some((approval, index) =>
      !Number.isFinite(approval.quantity_approved) ||
      approval.quantity_approved < 0 ||
      approval.quantity_approved > Number(items[index].quantity_requested),
    );
    if (invalid || !approvals.some((approval) => approval.quantity_approved > 0)) {
      setActionError("Số duyệt phải từ 0 đến số yêu cầu và ít nhất một dòng phải lớn hơn 0.");
      return;
    }
    void runMutation(() => approveOrder(id, { items: approvals }));
  };

  const confirmIssue = () => {
    if (!id) return;
    if (storageLocationsLoading) {
      setActionError("Danh sách vị trí kho vẫn đang tải.");
      return;
    }
    if (storageLocationsError || storageLocations.length === 0) {
      setActionError("Danh sách vị trí kho chưa sẵn sàng. Không thể issue hàng.");
      return;
    }
    const selected = items.flatMap((item) => {
      const values = itemValues[item.id];
      const quantity = Number(values?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return [];
      return [{ item, quantity, storageLocationId: values?.storageLocationId?.trim() ?? "" }];
    });
    if (selected.length === 0) {
      setActionError("Nhập ít nhất một số lượng cần cấp.");
      return;
    }
    if (selected.some(({ item, quantity, storageLocationId }) =>
      !storageLocations.some((location) => location.id === storageLocationId) ||
      quantity > itemRemaining(item),
    )) {
      setActionError("Cần chọn vị trí kho hợp lệ và số cấp không được vượt phần đã duyệt còn lại.");
      return;
    }
    void runMutation(() => issueOrder(id, {
      items: selected.map(({ item, quantity, storageLocationId }) => ({
        order_item_id: item.id,
        issues: [{ storage_location_id: storageLocationId, quantity }],
      })),
    }));
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Đang tải chi tiết order...</div>;
  }
  if (loadError || !order || !id) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <p className="font-semibold text-rose-700">{loadError ?? "Không tìm thấy order."}</p>
        <Link to="/admin/orders" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">Về danh sách</Link>
      </div>
    );
  }

  const hasActions = canEdit || canSubmit || canCancel || canApprove || canIssue || canReceive || canComplete;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/admin/orders" className="text-sm font-semibold text-blue-600 hover:underline">← Danh sách order</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.code}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">{order.id}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
          Tạo, submit và approve không thay đổi tồn kho.<br />Chỉ thao tác issue mới trừ tồn và tạo transaction.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          ["Area gửi", order.from_area_id],
          ["Area nhận", order.to_area_id],
          ["Người tạo", order.requested_by],
          ["Ngày tạo", formatDate(order.created_at)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Thao tác theo trạng thái và role</h2>
            <p className="mt-1 text-xs text-slate-500">Backend vẫn là lớp kiểm tra quyền cuối cùng.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <button onClick={startEditing} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sửa items</button>}
            {canSubmit && <button title="DRAFT → PENDING; không làm thay đổi tồn kho" disabled={mutating} onClick={() => void runMutation(() => submitOrder(id))} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">Submit → PENDING</button>}
            {canApprove && <button title="PENDING → APPROVED; không làm thay đổi tồn kho" onClick={() => openPanel("approve")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Approve → APPROVED</button>}
            {canApprove && <button onClick={() => openPanel("reject")} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Reject</button>}
            {canIssue && <button title="Issue mới trừ tồn và tạo StockTransactions" onClick={openIssuePanel} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">Issue hàng</button>}
            {canReceive && <button disabled={mutating} onClick={() => void runMutation(() => receiveOrder(id))} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">Xác nhận nhận</button>}
            {canComplete && <button disabled={mutating} onClick={() => void runMutation(() => completeOrder(id))} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Complete</button>}
            {canCancel && <button onClick={() => openPanel("cancel")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy order</button>}
          </div>
        </div>
        {!hasActions && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Không có thao tác phù hợp với role và trạng thái hiện tại.</p>}
        {mutating && <p className="mt-4 text-sm font-semibold text-blue-600">Đang cập nhật order...</p>}
        {actionError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</div>}
      </div>

      {panel === "approve" && (
        <ActionCard title="Duyệt số lượng" note="Approve chỉ cập nhật order, không trừ tồn.">
          <div className="space-y-3">
            {items.map((item) => (
              <QuantityRow key={item.id} item={item} label="Số lượng duyệt" value={itemValues[item.id]?.quantity ?? ""} max={item.quantity_requested} onChange={(quantity) => setItemValues((current) => ({ ...current, [item.id]: { ...current[item.id], quantity } }))} />
            ))}
          </div>
          <PanelButtons disabled={mutating} onCancel={() => setPanel(null)} onConfirm={confirmApprove} confirmLabel="Xác nhận approve" />
        </ActionCard>
      )}

      {panel === "reject" && (
        <ActionCard title="Từ chối order" note="rejected_reason là bắt buộc.">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500" placeholder="Lý do từ chối" />
          <PanelButtons disabled={mutating} onCancel={() => setPanel(null)} onConfirm={() => {
            if (!reason.trim()) return setActionError("Lý do từ chối là bắt buộc.");
            void runMutation(() => rejectOrder(id, { rejected_reason: reason.trim() }));
          }} confirmLabel="Xác nhận reject" danger />
        </ActionCard>
      )}

      {panel === "cancel" && (
        <ActionCard title="Hủy order" note={order.status === "PENDING" ? "cancel_reason là bắt buộc với order PENDING." : "Order DRAFT có thể hủy không cần lý do."}>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500" placeholder="Lý do hủy" />
          <PanelButtons disabled={mutating} onCancel={() => setPanel(null)} onConfirm={() => {
            if (order.status === "PENDING" && !reason.trim()) return setActionError("Lý do hủy là bắt buộc với order PENDING.");
            void runMutation(() => cancelOrder(id, { cancel_reason: reason.trim() || undefined }));
          }} confirmLabel="Xác nhận hủy" danger />
        </ActionCard>
      )}

      {panel === "issue" && (
        <ActionCard title="Cấp hàng" note="Issue là thao tác duy nhất trừ StockBalances và tạo StockTransactions.">
          <input type="search" value={storageLocationSearch} onChange={(event) => setStorageLocationSearch(event.target.value)} placeholder="Tìm vị trí kho trên server..." className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          {storageLocationsLoading && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              Đang tải vị trí kho của area nhận...
            </div>
          )}
          {storageLocationsError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {storageLocationsError}
            </div>
          )}
          {!storageLocationsLoading && !storageLocationsError && storageLocations.length === 0 && (
            <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Không có vị trí kho active trong area {order.to_area_id}.
            </div>
          )}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_1fr_1fr]">
                <div className="text-sm"><p className="font-semibold text-slate-800">{item.supply_id}</p><p className="mt-1 text-xs text-slate-500">Còn được cấp: {itemRemaining(item)}</p></div>
                <select
                  value={itemValues[item.id]?.storageLocationId ?? ""}
                  onChange={(event) => setItemValues((current) => ({ ...current, [item.id]: { ...current[item.id], storageLocationId: event.target.value } }))}
                  disabled={storageLocationsLoading || Boolean(storageLocationsError) || storageLocations.length === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">
                    {storageLocationsLoading
                      ? "Đang tải vị trí..."
                      : storageLocationsError
                        ? "Không thể tải vị trí"
                        : storageLocations.length === 0
                          ? "Không có vị trí active"
                          : "Chọn vị trí kho"}
                  </option>
                  {storageLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code}{location.name ? ` — ${location.name}` : ""}
                    </option>
                  ))}
                </select>
                <input type="number" min="0" step="any" max={itemRemaining(item)} value={itemValues[item.id]?.quantity ?? ""} onChange={(event) => setItemValues((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: event.target.value } }))} placeholder="Số lượng cấp" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            ))}
          </div>
          <PanelButtons disabled={mutating || storageLocationsLoading || Boolean(storageLocationsError) || storageLocations.length === 0} onCancel={() => setPanel(null)} onConfirm={confirmIssue} confirmLabel="Xác nhận issue" />
        </ActionCard>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><h2 className="font-bold text-slate-900">Order items</h2><p className="mt-1 text-xs text-slate-500">{items.length} dòng vật tư</p></div>
          {!canEdit && ["ISSUED", "RECEIVED", "COMPLETED"].includes(order.status) && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Items đã khóa</span>}
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Order chưa có item.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Supply ID</th><th className="px-5 py-3">Yêu cầu</th><th className="px-5 py-3">Đã duyệt</th><th className="px-5 py-3">Đã cấp</th><th className="px-5 py-3">Ghi chú</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-mono text-xs text-slate-700">{item.supply_id}</td>
                    <td className="px-5 py-4">{editing ? <input type="number" min="0.000001" step="any" value={itemValues[item.id]?.quantity ?? ""} onChange={(event) => setItemValues((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: event.target.value } }))} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5" /> : item.quantity_requested}</td>
                    <td className="px-5 py-4">{item.quantity_approved ?? "—"}</td>
                    <td className="px-5 py-4">{item.quantity_issued ?? 0}</td>
                    <td className="px-5 py-4">{editing ? <input value={itemValues[item.id]?.note ?? ""} onChange={(event) => setItemValues((current) => ({ ...current, [item.id]: { ...current[item.id], note: event.target.value } }))} className="w-full min-w-48 rounded-lg border border-slate-300 px-2 py-1.5" /> : (item.note ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editing && <div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Bỏ qua</button><button disabled={mutating} onClick={saveItems} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu items</button></div>}
      </div>

      {(order.note || order.rejected_reason || order.cancel_reason) && (
        <div className="grid gap-3 md:grid-cols-3">
          {order.note && <InfoNote label="Ghi chú" value={order.note} />}
          {order.rejected_reason && <InfoNote label="Lý do từ chối" value={order.rejected_reason} />}
          {order.cancel_reason && <InfoNote label="Lý do hủy" value={order.cancel_reason} />}
        </div>
      )}
    </section>
  );
};

const ActionCard = ({ title, note, children }: { title: string; note: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
    <h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{note}</p><div className="mt-4">{children}</div>
  </div>
);

const PanelButtons = ({ disabled, onCancel, onConfirm, confirmLabel, danger = false }: { disabled: boolean; onCancel: () => void; onConfirm: () => void; confirmLabel: string; danger?: boolean }) => (
  <div className="mt-4 flex justify-end gap-2"><button disabled={disabled} onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Bỏ qua</button><button disabled={disabled} onClick={onConfirm} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}>{confirmLabel}</button></div>
);

const QuantityRow = ({ item, label, value, max, onChange }: { item: OrderItem; label: string; value: string; max: number; onChange: (value: string) => void }) => (
  <label className="grid gap-3 rounded-xl border border-slate-200 p-3 text-sm md:grid-cols-[1fr_180px] md:items-center"><span><strong className="block text-slate-800">{item.supply_id}</strong><span className="text-xs text-slate-500">Yêu cầu: {item.quantity_requested}</span></span><span><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><input type="number" min="0" max={max} step="any" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></span></label>
);

const InfoNote = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-sm text-slate-700">{value}</p></div>;

export default OrderDetailPage;
