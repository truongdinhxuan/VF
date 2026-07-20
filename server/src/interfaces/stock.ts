import type { StockTransactionType } from '../domain/enums';

export interface StockBalanceListQuery {
  supply_id?: string;
  area_id?: string;
  storage_location_id?: string;
  low_stock?: string | boolean;
}

export interface StockTransactionListQuery {
  supply_id?: string;
  area_id?: string;
  type?: StockTransactionType;
  order_id?: string;
  date_from?: string;
  date_to?: string;
}

export type StockAdjustmentType = Extract<
  StockTransactionType,
  'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'IMPORT' | 'EXPORT'
>;

export interface CreateStockAdjustmentBody {
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  type: StockAdjustmentType;
  quantity: number;
  reason: string;
  note?: string | null;
}

export interface StockActor {
  id: string;
}
