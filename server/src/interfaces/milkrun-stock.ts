import type { PaginationQuery } from './pagination';

export interface MilkrunStockBalanceListQuery extends PaginationQuery {
  rackId?: string;
  areaId?: string;
}

export interface MilkrunStockTransactionListQuery extends PaginationQuery {
  rackId?: string;
  areaId?: string;
  transactionTypeId?: string;
  adjustmentReasonId?: string;
  createdBy?: string;
  tripId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateMilkrunStockAdjustmentBody {
  rack_id: string;
  transaction_type_id: string;
  adjustment_reason_id: string;
  quantity: number;
  reason_note?: string | null;
}
