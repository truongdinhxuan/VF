import type { FastifyInstance } from 'fastify';
import type { StockBalanceListQuery } from '../interfaces/stock';
import { parseOptionalBoolean, stockDatabaseError } from './stock.helpers';

const SELECT = `
  id, supply_id, area_id, storage_location_id, quantity, created_at, updated_at,
  supply:supplies!stock_balances_supply_id_fkey(
    id, code, short_text, min_stock,
    unit:units!supplies_unit_id_fkey(id, code, symbol, name)
  ),
  area:areas!stock_balances_area_id_fkey(id, code, name),
  storage_location:storage_locations!stock_balances_storage_location_id_fkey(id, code, name)
`;

interface BalanceWithSupply {
  supply_id: string;
  quantity: number | string;
  supply: { min_stock: number | string | null } | Array<{ min_stock: number | string | null }> | null;
  [key: string]: unknown;
}

const relationOne = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] ?? null : value;

export class StockBalancesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: StockBalanceListQuery) {
    const lowStock = parseOptionalBoolean(query.low_stock, 'low_stock');
    let request = this.db
      .from('stock_balances')
      .select(SELECT)
      .order('updated_at', { ascending: false });

    if (query.supply_id) request = request.eq('supply_id', query.supply_id);
    if (query.area_id) request = request.eq('area_id', query.area_id);
    if (query.storage_location_id) {
      request = request.eq('storage_location_id', query.storage_location_id);
    }

    const { data, error } = await request;
    if (error) stockDatabaseError(error, 'Cannot list stock balances');
    const allItems = (data ?? []) as unknown as BalanceWithSupply[];

    const totalMap = new Map<string, number>();
    for (const item of allItems) {
      totalMap.set(
        item.supply_id,
        (totalMap.get(item.supply_id) ?? 0) + Number(item.quantity),
      );
    }

    const items = lowStock === null
      ? allItems
      : allItems.filter((item) => {
          const supply = relationOne(item.supply);
          const threshold = Number(supply?.min_stock ?? 0);
          const isLow = (totalMap.get(item.supply_id) ?? 0) <= threshold;
          return lowStock ? isLow : !isLow;
        });

    return {
      items,
      totals_by_supply: [...totalMap.entries()].map(([supply_id, total_quantity]) => ({
        supply_id,
        total_quantity,
      })),
    };
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from('stock_balances')
      .select(SELECT)
      .eq('id', id)
      .single();
    if (error || !data) stockDatabaseError(error, 'Stock balance not found');
    return data;
  }
}
