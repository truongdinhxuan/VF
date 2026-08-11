import type { ApiEnvelope } from '../types/api';
import type {
  CreateMilkrunStockAdjustmentInput,
  MilkrunStockBalance,
  MilkrunStockBalanceListParams,
  MilkrunStockTransaction,
  MilkrunStockTransactionListParams,
} from '../types/milkrun';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listMilkrunStockBalances = (
  params: MilkrunStockBalanceListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<MilkrunStockBalance>> =>
  instance.get('milkrun/stock-balances', { params, signal });

export const listMilkrunStockTransactions = (
  params: MilkrunStockTransactionListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<MilkrunStockTransaction>> =>
  instance.get('milkrun/stock-transactions', { params, signal });

export const createMilkrunStockAdjustment = async (
  input: CreateMilkrunStockAdjustmentInput,
): Promise<MilkrunStockTransaction> => unwrapData(
  await instance.post<ApiEnvelope<MilkrunStockTransaction>, ApiEnvelope<MilkrunStockTransaction>>(
    'milkrun/stock-adjustments',
    input,
  ),
);
