import type { ApiEnvelope } from '../types/api';
import type {
  CreateStockAdjustmentInput,
  StockAdjustmentResult,
  StockTransaction,
  StockTransactionListParams,
} from '../types/stock-transactions';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listStockTransactions = async (
  params: StockTransactionListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<StockTransaction>> =>
  instance.get<PaginatedResponse<StockTransaction>, PaginatedResponse<StockTransaction>>(
    'stock-transactions',
    { params, signal },
  );

export const getStockTransaction = async (id: string): Promise<StockTransaction> =>
  unwrapData(
    await instance.get<ApiEnvelope<StockTransaction>, ApiEnvelope<StockTransaction>>(
      `stock-transactions/${id}`,
    ),
  );

export const createStockAdjustment = async (
  input: CreateStockAdjustmentInput,
): Promise<StockAdjustmentResult> =>
  unwrapData(
    await instance.post<ApiEnvelope<StockAdjustmentResult>, ApiEnvelope<StockAdjustmentResult>>(
      'stock-adjustments',
      input,
    ),
  );
