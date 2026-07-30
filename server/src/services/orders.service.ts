import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  ORDER_STATUS,
  ROLE_CODE,
  type OrderStatus,
  type RoleCode,
} from '../domain/enums';
import {
  assertApprovedQuantity,
  assertCancelReason,
  assertOrderActionAllowed,
  assertPositiveQuantity,
  assertRejectedReason,
  calculateStockAvailability,
  OrderRuleError,
} from '../domain/orderRules';
import {
  canApproveOrder,
  canCreateOrder,
  canIssueOrder,
  PACKING_ROLE,
} from '../domain/permissions';
import type {
  ApproveOrderBody,
  CancelOrderBody,
  CreateOrderBody,
  IssueOrderBody,
  OrderListItemInput,
  OrderListQuery,
  PatchOrderBody,
  ReceiveOrderBody,
  RejectOrderBody,
} from '../interfaces/orders';
import { ORDER_SORT_FIELDS } from '../schemas/orders';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';

export interface OrderActor {
  id: string;
  role: RoleCode;
  areaId: string;
}

interface SupplyLookup {
  id: string;
  unit_id: string;
  is_active: boolean;
  is_deleted: boolean;
}

interface OrderItemData {
  id: string;
  order_id: string;
  supply_id: string;
  unit_id: string;
  quantity_requested: number | string;
  quantity_approved: number | string | null;
  quantity_issued: number | string | null;
  note: string | null;
  available_quantity?: number;
  shortage_quantity?: number;
  has_stock_shortage?: boolean;
}

interface StockBalanceAvailabilityRow {
  supply_id: string;
  quantity: number | string;
}

interface OrderData {
  id: string;
  requested_by: string;
  from_area_id: string;
  to_area_id: string;
  status_id: string;
  status_lookup: {
    id: string;
    code: OrderStatus;
    name: string;
    is_active: boolean;
    is_deleted: boolean;
  };
  order_items: OrderItemData[];
  [key: string]: unknown;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

export class OrderServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'OrderServiceError';
  }
}

function serviceError(statusCode: number, message: string): never {
  throw new OrderServiceError(statusCode, message);
}

function translateRuleError(error: unknown): never {
  if (error instanceof OrderRuleError) {
    serviceError(409, error.message);
  }
  throw error;
}

function databaseError(error: SupabaseErrorLike | null, fallback: string): never {
  if (error?.code === 'PGRST116') serviceError(404, 'Order not found');
  serviceError(400, error?.message ?? fallback);
}

function normalizeListDate(
  value: string | undefined,
  field: string,
  endOfDay = false,
): string | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) serviceError(400, `${field} không hợp lệ`);
  return parsed.toISOString();
}

function rpcError(error: SupabaseErrorLike): never {
  const message = error.message ?? 'Cannot issue order';
  if (/does not belong to the order source area|inactive, deleted/i.test(message)) {
    serviceError(400, message);
  }
  if (/stock balance not found/i.test(message)) serviceError(409, message);
  if (/not found/i.test(message)) serviceError(404, message);
  if (/stock|approved|status|issue|location/i.test(message)) serviceError(409, message);
  serviceError(400, message);
}

const generateOrderCode = (): string => {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `ORD-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const ORDER_SOURCE_AREA_CODE = 'VTDG';

const ORDER_USER_SELECT = 'id, vinfast_id, email, first_name, last_name';

const ORDER_LIST_SELECT = `
  *,
  status_lookup:order_statuses!orders_status_id_fkey(
    id, code, name, is_active, is_deleted
  ),
  from_area:areas!orders_from_area_id_fkey(id, code, name),
  to_area:areas!orders_to_area_id_fkey(id, code, name),
  requester:users!orders_requested_by_fkey(${ORDER_USER_SELECT}),
  approver:users!orders_approved_by_fkey(${ORDER_USER_SELECT}),
  forklift:users!orders_forklift_by_fkey(${ORDER_USER_SELECT}),
  taken_away:users!orders_taken_away_by_fkey(${ORDER_USER_SELECT})
`;

const ORDER_DETAIL_SELECT = `
  ${ORDER_LIST_SELECT},
  order_items(
    *,
    supply:supplies!order_items_supply_id_fkey(id, code, description),
    unit:units!order_items_unit_id_fkey(id, code, symbol)
  ),
  order_revisions(
    id, order_id, action_id, old_status_id, new_status_id, reason, created_by, created_at,
    action:order_revision_actions!order_revisions_action_id_fkey(id, code, name),
    creator:users!order_revisions_created_by_fkey(
      ${ORDER_USER_SELECT}
    ),
    old_status:order_statuses!order_revisions_old_status_id_fkey(id, code, name),
    new_status:order_statuses!order_revisions_new_status_id_fkey(id, code, name)
  )
`;

export class OrderService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  private statusCode(order: OrderData): OrderStatus {
    const status = order.status_lookup;
    if (!status || !status.is_active || status.is_deleted) {
      serviceError(409, 'Order status lookup is inactive or missing');
    }
    return status.code;
  }

  private async getStatusId(code: string): Promise<string> {
    const normalized = code.trim().toUpperCase();
    const { data, error } = await this.db
      .from('order_statuses')
      .select('id')
      .eq('code', normalized)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();
    if (error || !data) serviceError(400, `Invalid order status code: ${normalized}`);
    return data.id as string;
  }

  private async findOrder(orderId: string): Promise<OrderData> {
    const { data, error } = await this.db
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', orderId)
      .eq('is_deleted', false)
      .single();

    if (error || !data) databaseError(error, 'Cannot get order');
    return this.attachStockAvailability(data as OrderData);
  }

  private async attachStockAvailability(order: OrderData): Promise<OrderData> {
    const supplyIds = [...new Set(order.order_items.map((item) => item.supply_id))];
    if (supplyIds.length === 0) return order;

    const { data, error } = await this.db
      .from('stock_balances')
      .select(`
        supply_id,
        quantity,
        storage_location:storage_locations!stock_balances_storage_location_id_fkey!inner(id)
      `)
      .eq('area_id', order.from_area_id)
      .eq('is_deleted', false)
      .eq('storage_location.is_active', true)
      .in('supply_id', supplyIds);

    if (error) databaseError(error, 'Cannot calculate order stock availability');

    const availableBySupply = new Map<string, number>();
    for (const balance of (data ?? []) as StockBalanceAvailabilityRow[]) {
      const quantity = Number(balance.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      availableBySupply.set(
        balance.supply_id,
        (availableBySupply.get(balance.supply_id) ?? 0) + quantity,
      );
    }

    return {
      ...order,
      order_items: order.order_items.map((item) => ({
        ...item,
        ...calculateStockAvailability(
          Number(item.quantity_requested),
          availableBySupply.get(item.supply_id) ?? 0,
        ),
      })),
    };
  }

  private assertPackingOwner(actor: OrderActor, order: OrderData): void {
    if (actor.role === ROLE_CODE.ADMIN) return;
    if (
      actor.role !== PACKING_ROLE ||
      order.requested_by !== actor.id ||
      order.to_area_id !== actor.areaId
    ) {
      serviceError(403, 'Only the packing owner can modify this order');
    }
  }

  private assertOrderVisible(actor: OrderActor, order: OrderData): void {
    if (actor.role === PACKING_ROLE && order.to_area_id !== actor.areaId) {
      serviceError(403, 'Order is outside your area scope');
    }
  }

  private async getOrderSourceAreaId(): Promise<string> {
    const { data, error } = await this.db
      .from('areas')
      .select('id')
      .eq('code', ORDER_SOURCE_AREA_CODE)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (error || !data) {
      serviceError(
        500,
        `Order source area ${ORDER_SOURCE_AREA_CODE} is missing or inactive`,
      );
    }
    return data.id;
  }

  private async assertActiveReceivingArea(areaId: string): Promise<void> {
    const { data, error } = await this.db
      .from('areas')
      .select('id')
      .eq('id', areaId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();

    if (error || !data) {
      serviceError(400, 'User receiving area is missing or inactive');
    }
  }

  private async prepareOrderItems(
    orderList: OrderListItemInput[],
  ): Promise<Array<OrderListItemInput & { unit_id: string }>> {
    if (!Array.isArray(orderList) || orderList.length === 0) {
      serviceError(400, 'order_list must contain at least one item');
    }

    for (const item of orderList) {
      if (!item?.supply_id) serviceError(400, 'supply_id is required');
      try {
        assertPositiveQuantity(item.quantity_requested, 'quantity_requested');
      } catch (error) {
        translateRuleError(error);
      }
    }

    const supplyIds = [...new Set(orderList.map((item) => item.supply_id))];
    const { data, error } = await this.db
      .from('supplies')
      .select('id, unit_id, is_active, is_deleted')
      .in('id', supplyIds);

    if (error) databaseError(error, 'Cannot validate supplies');
    const supplyMap = new Map(
      ((data ?? []) as SupplyLookup[]).map((supply) => [supply.id, supply]),
    );

    return orderList.map((item) => {
      const supply = supplyMap.get(item.supply_id);
      if (!supply) {
        serviceError(400, `Supply ${item.supply_id} does not exist or is inactive`);
      }
      if (!supply.is_active || supply.is_deleted) {
        serviceError(400, `Supply ${item.supply_id} does not exist or is inactive`);
      }
      return {
        ...item,
        quantity_requested: Number(item.quantity_requested),
        unit_id: item.unit_id ?? supply.unit_id,
      };
    });
  }

  async create(actor: OrderActor, body: CreateOrderBody) {
    if (!canCreateOrder(actor.role)) serviceError(403, 'Role cannot create orders');
    if (!body?.from_area_id || !body.to_area_id) {
      serviceError(400, 'from_area_id and to_area_id are required');
    }
    const [sourceAreaId] = await Promise.all([
      this.getOrderSourceAreaId(),
      this.assertActiveReceivingArea(actor.areaId),
    ]);
    if (body.from_area_id !== sourceAreaId) {
      serviceError(400, `from_area_id must reference area code ${ORDER_SOURCE_AREA_CODE}`);
    }
    if (body.to_area_id !== actor.areaId) {
      serviceError(400, 'to_area_id must equal the current user area_id');
    }

    const items = await this.prepareOrderItems(body.order_list);
    const draftStatusId = await this.getStatusId(ORDER_STATUS.DRAFT);
    const { data: order, error: orderError } = await this.db
      .from('orders')
      .insert({
        code: generateOrderCode(),
        from_area_id: sourceAreaId,
        to_area_id: actor.areaId,
        requested_by: actor.id,
        status_id: draftStatusId,
        note: body.note ?? null,
      })
      .select('*')
      .single();

    if (orderError || !order) databaseError(orderError, 'Cannot create order');

    const { error: itemError } = await this.db.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        supply_id: item.supply_id,
        unit_id: item.unit_id,
        quantity_requested: item.quantity_requested,
        note: item.note ?? null,
      })),
    );

    if (itemError) {
      await this.db.from('orders').delete().eq('id', order.id);
      databaseError(itemError, 'Cannot create order items');
    }

    return this.findOrder(order.id);
  }

  async patch(actor: OrderActor, orderId: string, body: PatchOrderBody) {
    const order = await this.findOrder(orderId);
    this.assertPackingOwner(actor, order);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'edit');
    } catch (error) {
      translateRuleError(error);
    }

    if (!body || (body.note === undefined && body.order_list === undefined)) {
      serviceError(400, 'No order fields were provided');
    }

    if (body.order_list !== undefined) {
      const items = await this.prepareOrderItems(body.order_list);
      const { error: deleteError } = await this.db
        .from('order_items')
        .delete()
        .eq('order_id', orderId);
      if (deleteError) databaseError(deleteError, 'Cannot replace order items');

      const { error: insertError } = await this.db.from('order_items').insert(
        items.map((item) => ({
          order_id: orderId,
          supply_id: item.supply_id,
          unit_id: item.unit_id,
          quantity_requested: item.quantity_requested,
          note: item.note ?? null,
        })),
      );
      if (insertError) databaseError(insertError, 'Cannot replace order items');
    }

    if (body.note !== undefined) {
      const { error } = await this.db
        .from('orders')
        .update({ note: body.note })
        .eq('id', orderId);
      if (error) databaseError(error, 'Cannot update order');
    }

    return this.findOrder(orderId);
  }

  async submit(actor: OrderActor, orderId: string) {
    const order = await this.findOrder(orderId);
    this.assertPackingOwner(actor, order);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'submit');
    } catch (error) {
      translateRuleError(error);
    }
    if (!order.order_items.length) serviceError(400, 'Order must contain at least one item');

    const pendingStatusId = await this.getStatusId(ORDER_STATUS.PENDING);
    const { error } = await this.db
      .from('orders')
      .update({ status_id: pendingStatusId, submitted_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status_id', order.status_id);
    if (error) databaseError(error, 'Cannot submit order');
    return this.findOrder(orderId);
  }

  async list(actor: OrderActor, query: OrderListQuery = {}) {
    const statusId = query.status ? await this.getStatusId(query.status) : null;
    const pagination = parsePagination(query, {
      allowedSortBy: ORDER_SORT_FIELDS,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    });

    let request = this.db
      .from('orders')
      .select(ORDER_LIST_SELECT, { count: 'exact' })
      .eq('is_deleted', false);
    if (actor.role === PACKING_ROLE) request = request.eq('to_area_id', actor.areaId);
    if (statusId) request = request.eq('status_id', statusId);
    if (query.from_area_id) request = request.eq('from_area_id', query.from_area_id);
    if (query.to_area_id) request = request.eq('to_area_id', query.to_area_id);
    if (query.createdBy) request = request.eq('requested_by', query.createdBy);
    if (query.areaId) {
      request = request.or(
        `from_area_id.eq.${query.areaId},to_area_id.eq.${query.areaId}`,
      );
    }
    if (pagination.search) {
      request = request.or(
        `code.ilike.*${pagination.search}*,note.ilike.*${pagination.search}*,rejected_reason.ilike.*${pagination.search}*,cancel_reason.ilike.*${pagination.search}*`,
      );
    }

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) serviceError(400, 'date must be YYYY-MM-DD');
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      request = request.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
    } else {
      const dateFrom = normalizeListDate(query.dateFrom, 'dateFrom');
      const dateTo = normalizeListDate(query.dateTo, 'dateTo', true);
      if (dateFrom && dateTo && dateFrom > dateTo) {
        serviceError(400, 'dateFrom phải nhỏ hơn hoặc bằng dateTo');
      }
      if (dateFrom) request = request.gte('created_at', dateFrom);
      if (dateTo) request = request.lte('created_at', dateTo);
    }
    const sortBy = pagination.sortBy === 'status' ? 'status_id' : pagination.sortBy;
    request = request.order(sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (sortBy !== 'id') request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Cannot list orders');
    throw new Error('Unreachable pagination state');
  }

  async get(actor: OrderActor, orderId: string) {
    const order = await this.findOrder(orderId);
    this.assertOrderVisible(actor, order);
    return order;
  }

  async approve(actor: OrderActor, orderId: string, body: ApproveOrderBody) {
    if (!canApproveOrder(actor.role)) serviceError(403, 'Role cannot approve orders');
    const order = await this.findOrder(orderId);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'approve');
    } catch (error) {
      translateRuleError(error);
    }

    if (!Array.isArray(body?.items) || body.items.length !== order.order_items.length) {
      serviceError(400, 'Approval must include every order item');
    }
    const approvalMap = new Map(body.items.map((item) => [item.order_item_id, item]));
    if (approvalMap.size !== body.items.length) serviceError(400, 'Duplicate order_item_id');

    const updates = order.order_items.map((item) => {
      const approval = approvalMap.get(item.id);
      if (!approval) serviceError(400, `Missing approval for order item ${item.id}`);
      try {
        return {
          id: item.id,
          order_id: item.order_id,
          supply_id: item.supply_id,
          unit_id: item.unit_id,
          quantity_requested: Number(item.quantity_requested),
          quantity_approved: assertApprovedQuantity(
            approval.quantity_approved,
            Number(item.quantity_requested),
          ),
          quantity_issued:
            item.quantity_issued === null ? null : Number(item.quantity_issued),
          note: item.note,
        };
      } catch (error) {
        return translateRuleError(error);
      }
    });

    const { error: orderError } = await this.db.rpc('review_order', {
      p_order_id: orderId,
      p_actor_id: actor.id,
      p_action_code: 'APPROVE',
      p_items: updates.map((item) => ({
        order_item_id: item.id,
        quantity_approved: item.quantity_approved,
      })),
      p_reason: null,
      p_note: body.note ?? null,
    });
    if (orderError) rpcError(orderError);
    return this.findOrder(orderId);
  }

  async reject(actor: OrderActor, orderId: string, body: RejectOrderBody) {
    if (!canApproveOrder(actor.role)) serviceError(403, 'Role cannot reject orders');
    const order = await this.findOrder(orderId);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'reject');
      const rejectedReason = assertRejectedReason(body?.rejected_reason);
      const { error } = await this.db.rpc('review_order', {
        p_order_id: orderId,
        p_actor_id: actor.id,
        p_action_code: 'REJECT',
        p_items: null,
        p_reason: rejectedReason,
        p_note: null,
      });
      if (error) rpcError(error);
    } catch (error) {
      translateRuleError(error);
    }
    return this.findOrder(orderId);
  }

  async issue(actor: OrderActor, orderId: string, body: IssueOrderBody) {
    if (!canIssueOrder(actor.role)) serviceError(403, 'Role cannot issue orders');
    const order = await this.findOrder(orderId);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'issue');
      if (!Array.isArray(body?.items) || body.items.length === 0) {
        serviceError(400, 'items must contain at least one issue');
      }
      for (const item of body.items) {
        if (!item.order_item_id || !Array.isArray(item.issues) || item.issues.length === 0) {
          serviceError(400, 'Each order item must contain issues');
        }
        for (const issue of item.issues) {
          if (!issue.storage_location_id) serviceError(400, 'storage_location_id is required');
          assertPositiveQuantity(issue.quantity, 'issue quantity');
        }
      }
    } catch (error) {
      translateRuleError(error);
    }

    const { error } = await this.db.rpc('issue_order', {
      p_order_id: orderId,
      p_actor_id: actor.id,
      p_items: body.items,
      p_forklift_by: body.forklift_by ?? null,
      p_taken_away_by: body.taken_away_by ?? null,
    });
    if (error) rpcError(error);

    const result = await this.findOrder(orderId);
    const { data: transactions, error: transactionError } = await this.db
      .from('stock_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (transactionError) databaseError(transactionError, 'Cannot get issue transactions');
    return { ...result, stock_transactions: transactions ?? [] };
  }

  async receive(actor: OrderActor, orderId: string, body: ReceiveOrderBody) {
    const order = await this.findOrder(orderId);
    this.assertPackingOwner(actor, order);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'receive');
    } catch (error) {
      translateRuleError(error);
    }

    const receivedStatusId = await this.getStatusId(ORDER_STATUS.RECEIVED);
    const { error } = await this.db
      .from('orders')
      .update({
        status_id: receivedStatusId,
        received_at: new Date().toISOString(),
        ...(body?.taken_away_by ? { taken_away_by: body.taken_away_by } : {}),
      })
      .eq('id', orderId)
      .eq('status_id', order.status_id);
    if (error) databaseError(error, 'Cannot receive order');
    return this.findOrder(orderId);
  }

  async complete(actor: OrderActor, orderId: string) {
    if (!canIssueOrder(actor.role)) serviceError(403, 'Role cannot complete orders');
    const order = await this.findOrder(orderId);
    try {
      assertOrderActionAllowed(this.statusCode(order), 'complete');
    } catch (error) {
      translateRuleError(error);
    }

    const hasPendingIssue = order.order_items.some(
      (item) =>
        item.quantity_approved === null ||
        Number(item.quantity_issued ?? 0) < Number(item.quantity_approved),
    );
    if (hasPendingIssue) serviceError(409, 'Order still has quantity pending issue');

    const completedStatusId = await this.getStatusId(ORDER_STATUS.COMPLETED);
    const { error } = await this.db
      .from('orders')
      .update({ status_id: completedStatusId, completed_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status_id', order.status_id);
    if (error) databaseError(error, 'Cannot complete order');
    return this.findOrder(orderId);
  }

  async cancel(actor: OrderActor, orderId: string, body: CancelOrderBody) {
    const order = await this.findOrder(orderId);
    this.assertPackingOwner(actor, order);
    try {
      const currentStatus = this.statusCode(order);
      assertOrderActionAllowed(currentStatus, 'cancel');
      const cancelReason = assertCancelReason(currentStatus, body?.cancel_reason);
      const cancelledStatusId = await this.getStatusId(ORDER_STATUS.CANCELLED);
      const { error } = await this.db
        .from('orders')
        .update({ status_id: cancelledStatusId, cancel_reason: cancelReason })
        .eq('id', orderId)
        .eq('status_id', order.status_id);
      if (error) databaseError(error, 'Cannot cancel order');
    } catch (error) {
      translateRuleError(error);
    }
    return this.findOrder(orderId);
  }
}
