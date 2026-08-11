import type { FastifyInstance } from 'fastify';
import type {
  CreateMilkrunStockAdjustmentBody,
  MilkrunStockBalanceListQuery,
  MilkrunStockTransactionListQuery,
} from '../interfaces/milkrun-stock';
import type {} from '../plugins/dbContext';
import {
  MILKRUN_STOCK_BALANCE_SORT_FIELDS,
  MILKRUN_STOCK_TRANSACTION_SORT_FIELDS,
} from '../schemas/milkrun-stock';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import { MilkrunAreaService } from './milkrun-area.service';
import {
  assertFilterId,
  databaseError,
  fail,
  normalizeOptionalText,
} from './master-data.helpers';
import { loadPublicUsersById } from './milkrun-public-relations.service';

const STOCK_BALANCE_SELECT = `
  id, rack_id, area_id, quantity,
  is_active, is_deleted, created_at, updated_at,
  rack:racks!stock_balances_rack_id_fkey!inner(id, code, name, image_url)
`;

const STOCK_TRANSACTION_SELECT = `
  id, rack_id, area_id, trip_id, trip_item_id,
  transaction_type_id, adjustment_reason_id,
  quantity, before_quantity, after_quantity, reason_note, created_by,
  is_active, is_deleted, created_at, updated_at,
  rack:racks!stock_transactions_rack_id_fkey(id, code, name, image_url),
  transaction_type:stock_transaction_types!stock_transactions_transaction_type_id_fkey(
    id, code, name, effect, requires_reason
  ),
  adjustment_reason:adjustment_reasons!stock_transactions_adjustment_reason_id_fkey(
    id, code, name, description
  )
`;

const classifyAdjustmentError = (message: string): never => {
  if (/permission denied/i.test(message)) fail(403, message);
  if (/unavailable|not found/i.test(message)) fail(404, message);
  if (/insufficient/i.test(message)) fail(409, message);
  return fail(400, message || 'Không thể điều chỉnh tồn Milkrun');
};

export class MilkrunStockService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin.schema('milkrun');
  }

  async listBalances(query: MilkrunStockBalanceListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: MILKRUN_STOCK_BALANCE_SORT_FIELDS,
      defaultSortBy: 'updated_at',
      defaultSortOrder: 'desc',
    });
    const rackId = assertFilterId(query.rackId, 'rackId');
    const requestedAreaId = assertFilterId(query.areaId, 'areaId');
    const area = await new MilkrunAreaService(this.fastify).getActiveArea();
    if (requestedAreaId && requestedAreaId !== area.id) {
      fail(400, 'Milkrun chỉ sử dụng Area EDC_LOGISTICS');
    }

    let request = this.db
      .from('stock_balances')
      .select(STOCK_BALANCE_SELECT, { count: 'exact' })
      .eq('area_id', area.id)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (rackId) request = request.eq('rack_id', rackId);
    if (pagination.search) {
      request = request.or(
        `code.ilike.*${pagination.search}*,name.ilike.*${pagination.search}*`,
        { referencedTable: 'rack' },
      );
    }

    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(
      pagination.from,
      pagination.to,
    );
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) {
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          area: { id: area.id, code: area.code, name: area.name },
        })),
      };
    }
    databaseError(error, 'Không thể tải tồn rack Milkrun');
  }

  async listTransactions(query: MilkrunStockTransactionListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: MILKRUN_STOCK_TRANSACTION_SORT_FIELDS,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    });
    const rackId = assertFilterId(query.rackId, 'rackId');
    const requestedAreaId = assertFilterId(query.areaId, 'areaId');
    const transactionTypeId = assertFilterId(
      query.transactionTypeId,
      'transactionTypeId',
    );
    const adjustmentReasonId = assertFilterId(
      query.adjustmentReasonId,
      'adjustmentReasonId',
    );
    const createdBy = assertFilterId(query.createdBy, 'createdBy');
    const tripId = assertFilterId(query.tripId, 'tripId');
    const area = await new MilkrunAreaService(this.fastify).getActiveArea();
    if (requestedAreaId && requestedAreaId !== area.id) {
      fail(400, 'Milkrun chỉ sử dụng Area EDC_LOGISTICS');
    }

    let request = this.db
      .from('stock_transactions')
      .select(STOCK_TRANSACTION_SELECT, { count: 'exact' })
      .eq('area_id', area.id)
      .eq('is_deleted', false);

    if (rackId) request = request.eq('rack_id', rackId);
    if (transactionTypeId) {
      request = request.eq('transaction_type_id', transactionTypeId);
    }
    if (adjustmentReasonId) {
      request = request.eq('adjustment_reason_id', adjustmentReasonId);
    }
    if (createdBy) request = request.eq('created_by', createdBy);
    if (tripId) request = request.eq('trip_id', tripId);
    if (query.dateFrom) request = request.gte('created_at', query.dateFrom);
    if (query.dateTo) request = request.lte('created_at', query.dateTo);
    if (pagination.search) {
      request = request.ilike('reason_note', `*${pagination.search}*`);
    }

    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(
      pagination.from,
      pagination.to,
    );
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) {
      const creators = await loadPublicUsersById(
        this.fastify,
        result.items.map((item) => item.created_by as string | null),
      );
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          area: { id: area.id, code: area.code, name: area.name },
          creator: item.created_by
            ? creators.get(item.created_by as string) ?? null
            : null,
        })),
      };
    }
    databaseError(error, 'Không thể tải lịch sử tồn Milkrun');
  }

  async createAdjustment(
    actorId: string,
    body: CreateMilkrunStockAdjustmentBody,
  ) {
    const area = await new MilkrunAreaService(this.fastify).getActiveArea();
    const { data: transactionId, error } = await this.db.rpc(
      'apply_stock_adjustment',
      {
        p_actor_id: actorId,
        p_rack_id: body.rack_id,
        p_area_id: area.id,
        p_transaction_type_id: body.transaction_type_id,
        p_adjustment_reason_id: body.adjustment_reason_id,
        p_quantity: body.quantity,
        p_reason_note: normalizeOptionalText(body.reason_note, 'reason_note') ?? null,
      },
    );
    if (error || !transactionId) {
      classifyAdjustmentError(error?.message ?? 'Milkrun adjustment failed');
    }

    const { data, error: readError } = await this.db
      .from('stock_transactions')
      .select(STOCK_TRANSACTION_SELECT)
      .eq('id', transactionId as string)
      .single();
    if (readError || !data) {
      databaseError(readError, 'Đã điều chỉnh tồn nhưng không thể tải transaction');
    }
    const transaction = data!;
    const creators = await loadPublicUsersById(
      this.fastify,
      [transaction.created_by as string | null],
    );
    return {
      ...transaction,
      area: { id: area.id, code: area.code, name: area.name },
      creator: transaction.created_by
        ? creators.get(transaction.created_by as string) ?? null
        : null,
    };
  }
}
