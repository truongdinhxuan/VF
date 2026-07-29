import type { Area } from './areas';
import type { StorageLocation } from './storage-locations';
import type { PaginatedListParams } from './pagination.types';
import type {
  AdjustmentReasonLookup,
  StockTransactionTypeLookup,
} from './lookups';

export const STOCK_TRANSACTION_TYPES = [
  'ISSUE',
  'RECEIVE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'IMPORT',
  'EXPORT',
  'REVERSAL_IN',
  'REVERSAL_OUT',
] as const;

export type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number];
export type StockAdjustmentType = Extract<
  StockTransactionType,
  'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'IMPORT' | 'EXPORT'
>;

export interface StockTransaction {
  id: string;
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  order_id: string | null;
  order_item_id: string | null;
  transaction_type_id: string;
  quantity: number;
  before_quantity: number;
  after_quantity: number;
  reason: string | null;
  reason_id: string | null;
  reason_note: string | null;
  note: string | null;
  created_by: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  transaction_type?: StockTransactionTypeLookup | null;
  adjustment_reason?: AdjustmentReasonLookup | null;
  supply?: { id: string; code: string; description: string | null } | null;
  area?: Pick<Area, 'id' | 'code' | 'name'> | null;
  storage_location?: Pick<StorageLocation, 'id' | 'code' | 'name'> | null;
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    vinfast_id: number;
  } | null;
}

export interface StockTransactionListParams extends PaginatedListParams {
  supplyId?: string;
  areaId?: string;
  storageLocationId?: string;
  type?: StockTransactionType;
  transactionTypeId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateStockAdjustmentInput {
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  type?: StockAdjustmentType;
  transaction_type_id?: string;
  transaction_type_code?: StockAdjustmentType;
  adjustment_reason_id?: string;
  quantity: number;
  reason: string;
  reason_note?: string;
  note?: string | null;
}

export interface StockAdjustmentResult {
  balance: {
    id: string;
    supply_id: string;
    area_id: string;
    storage_location_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
  };
  transaction: StockTransaction;
}
