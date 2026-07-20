import type { StockAdjustmentType } from '../interfaces/stock';

export const STOCK_ADJUSTMENT_TYPES = [
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'IMPORT',
  'EXPORT',
] as const satisfies readonly StockAdjustmentType[];

export class StockRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockRuleError';
  }
}

export const assertStockAdjustmentType = (
  value: unknown,
): StockAdjustmentType => {
  if (!STOCK_ADJUSTMENT_TYPES.includes(value as StockAdjustmentType)) {
    throw new StockRuleError('type must be a supported stock adjustment type');
  }
  return value as StockAdjustmentType;
};

export const assertPositiveStockQuantity = (value: unknown): number => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new StockRuleError('quantity must be greater than 0');
  }
  return quantity;
};

export const normalizeStockReason = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StockRuleError('reason is required for stock changes outside an order');
  }
  if (value.trim().length > 2000) {
    throw new StockRuleError('reason must not exceed 2000 characters');
  }
  return value.trim();
};
