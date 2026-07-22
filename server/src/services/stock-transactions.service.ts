import type { FastifyInstance } from 'fastify';
import type { StockTransactionListQuery } from '../interfaces/stock';
import { STOCK_TRANSACTION_SORT_FIELDS } from '../schemas/stock';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import {
  normalizeDateBoundary,
  stockDatabaseError,
  stockFail,
} from './stock.helpers';
import {
  inCondition,
  resolveStockSearchReferences,
} from './stock-search';

const SELECT = `
  id, supply_id, area_id, storage_location_id, order_id, order_item_id,
  type, quantity, before_quantity, after_quantity, reason, note, created_by, created_at,
  supply:supplies!stock_transactions_supply_id_fkey(id, code, description),
  area:areas!stock_transactions_area_id_fkey(id, code, name),
  storage_location:storage_locations!stock_transactions_storage_location_id_fkey(id, code, name),
  creator:users!stock_transactions_created_by_fkey(id, first_name, last_name, vinfast_id)
`;

export class StockTransactionsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: StockTransactionListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: STOCK_TRANSACTION_SORT_FIELDS,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    });
    const dateFrom = normalizeDateBoundary(
      query.dateFrom ?? query.date_from,
      'dateFrom',
    );
    const dateTo = normalizeDateBoundary(
      query.dateTo ?? query.date_to,
      'dateTo',
      true,
    );
    if (dateFrom && dateTo && dateFrom > dateTo) {
      stockFail(400, 'date_from must be before or equal to date_to');
    }

    let request = this.db
      .from('stock_transactions')
      .select(SELECT, { count: 'exact' });

    const supplyId = query.supplyId ?? query.supply_id;
    const areaId = query.areaId ?? query.area_id;
    if (supplyId) request = request.eq('supply_id', supplyId);
    if (areaId) request = request.eq('area_id', areaId);
    if (query.storageLocationId) {
      request = request.eq('storage_location_id', query.storageLocationId);
    }
    if (query.createdBy) request = request.eq('created_by', query.createdBy);
    if (query.type) request = request.eq('type', query.type);
    if (query.order_id) request = request.eq('order_id', query.order_id);
    if (dateFrom) request = request.gte('created_at', dateFrom);
    if (dateTo) request = request.lte('created_at', dateTo);
    if (pagination.search) {
      const references = await resolveStockSearchReferences(
        this.db,
        pagination.search,
        true,
      );
      const conditions = [
        `reason.ilike.*${pagination.search}*`,
        `note.ilike.*${pagination.search}*`,
        inCondition('supply_id', references.supplyIds),
        inCondition('area_id', references.areaIds),
        inCondition('storage_location_id', references.storageLocationIds),
        inCondition('created_by', references.creatorIds),
      ].filter((condition): condition is string => Boolean(condition));
      request = request.or(conditions.join(','));
    }
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) stockDatabaseError(error, 'Cannot list stock transactions');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from('stock_transactions')
      .select(SELECT)
      .eq('id', id)
      .single();
    if (error || !data) stockDatabaseError(error, 'Stock transaction not found');
    return data;
  }
}
