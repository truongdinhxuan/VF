export const ROLE_CODE = {
  ADMIN: 'ADMIN',
  DATA_PACKING: 'DATA_PACKING',
  DATA_MATERIAL: 'DATA_MATERIAL',
  MATERIAL_LEADER: 'MATERIAL_LEADER',
  MATERIAL_CONTROL: 'MATERIAL_CONTROL',
} as const;

export type RoleCode = (typeof ROLE_CODE)[keyof typeof ROLE_CODE];

export const ROLE_CODES = Object.values(ROLE_CODE) as RoleCode[];

export const normalizeRoleCode = (value: unknown): RoleCode | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return ROLE_CODES.includes(trimmed as RoleCode) ? trimmed as RoleCode : null;
};

export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PARTIAL_ISSUED: 'PARTIAL_ISSUED',
  ISSUED: 'ISSUED',
  RECEIVED: 'RECEIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const ORDER_STATUSES = Object.values(ORDER_STATUS) as OrderStatus[];

export const STOCK_TRANSACTION_TYPE_CODE = {
  ISSUE: 'ISSUE',
  RECEIVE: 'RECEIVE',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  REVERSAL_IN: 'REVERSAL_IN',
  REVERSAL_OUT: 'REVERSAL_OUT',
} as const;

export type StockTransactionType =
  (typeof STOCK_TRANSACTION_TYPE_CODE)[keyof typeof STOCK_TRANSACTION_TYPE_CODE];
export const STOCK_TRANSACTION_TYPES =
  Object.values(STOCK_TRANSACTION_TYPE_CODE) as StockTransactionType[];

export const ORDER_REVISION_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  ISSUE: 'ISSUE',
  CANCEL: 'CANCEL',
  REVERT_STATUS: 'REVERT_STATUS',
  STOCK_REVERSAL: 'STOCK_REVERSAL',
} as const;

export type OrderRevisionActionCode =
  (typeof ORDER_REVISION_ACTION)[keyof typeof ORDER_REVISION_ACTION];
