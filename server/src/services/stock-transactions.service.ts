import type { FastifyInstance } from 'fastify';
import type { StockTransactionListQuery } from '../interfaces/stock';
import {
  normalizeDateBoundary,
  stockDatabaseError,
  stockFail,
} from './stock.helpers';

const SELECT = `
  id, supply_id, area_id, storage_location_id, order_id, order_item_id,
  type, quantity, before_quantity, after_quantity, reason, note, created_by, created_at,
  supply:supplies!stock_transactions_supply_id_fkey(id, code, short_text),
  area:areas!stock_transactions_area_id_fkey(id, code, name),
  storage_location:storage_locations!stock_transactions_storage_location_id_fkey(id, code, name),
  creator:users!stock_transactions_created_by_fkey(id, first_name, last_name, vinfast_id)
`;

export class StockTransactionsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: StockTransactionListQuery) {
    const dateFrom = normalizeDateBoundary(query.date_from, 'date_from');
    const dateTo = normalizeDateBoundary(query.date_to, 'date_to', true);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      stockFail(400, 'date_from must be before or equal to date_to');
    }

    let request = this.db
      .from('stock_transactions')
      .select(SELECT)
      .order('created_at', { ascending: false });

    if (query.supply_id) request = request.eq('supply_id', query.supply_id);
    if (query.area_id) request = request.eq('area_id', query.area_id);
    if (query.type) request = request.eq('type', query.type);
    if (query.order_id) request = request.eq('order_id', query.order_id);
    if (dateFrom) request = request.gte('created_at', dateFrom);
    if (dateTo) request = request.lte('created_at', dateTo);

    const { data, error } = await request;
    if (error) stockDatabaseError(error, 'Cannot list stock transactions');
    return data ?? [];
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
