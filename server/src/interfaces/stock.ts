import type { StockTransactionType } from '../domain/enums';
import type { PaginationQuery } from './pagination';

export interface StockBalanceListQuery extends PaginationQuery {
  supply_id?: string;
  supplyId?: string;
  area_id?: string;
  areaId?: string;
  storage_location_id?: string;
  storageLocationId?: string;
  low_stock?: string | boolean;
}

export interface StockTransactionListQuery extends PaginationQuery {
  supply_id?: string;
  supplyId?: string;
  area_id?: string;
  areaId?: string;
  storageLocationId?: string;
  type?: string;
  transactionTypeId?: string;
  order_id?: string;
  createdBy?: string;
  date_from?: string;
  date_to?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type StockAdjustmentType = Extract<
  StockTransactionType,
  'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'IMPORT' | 'EXPORT'
>;

export interface CreateStockAdjustmentBody {
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  type?: StockAdjustmentType;
  transaction_type_id?: string;
  transaction_type_code?: StockAdjustmentType;
  adjustment_reason_id?: string;
  quantity: number;
  reason?: string;
  reason_note?: string;
  note?: string | null;
}

export interface StockActor {
  id: string;
}
