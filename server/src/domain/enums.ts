export const ROLE_NAMES = [
  'data Đóng gói',
  'data Vật tư',
  'Tổ trưởng vật tư',
  'Material Control',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ORDER_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PARTIAL_ISSUED',
  'ISSUED',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STOCK_TRANSACTION_TYPES = [
  'ISSUE',
  'RECEIVE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'IMPORT',
  'EXPORT',
] as const;

export type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number];
