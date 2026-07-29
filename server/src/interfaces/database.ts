import type {
  OrderStatus,
  RoleCode,
  StockTransactionType,
} from '../domain/enums';

export interface RoleRecord {
  id: string;
  code: RoleCode;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AreaRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  vinfast_id: number;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
  role_id: string;
  area_id: string;
  managed_by_user_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
}

export interface SupplyCategoryRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface UnitRecord {
  id: string;
  code: string;
  symbol: string;
  name: string;
  description: string | null;
  is_active: boolean;
  updated_at: string;
  created_at: string;
  is_deleted: boolean;
}

export interface SupplyRecord {
  id: string;
  code: string;
  short_text: string;
  translation_text: string | null;
  description: string | null;
  category_id: string;
  unit_id: string;
  min_stock: number | null;
  max_stock: number | null;
  safety_stock: number | null;
  image_url: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorageLocationRecord {
  id: string;
  code: string;
  area_id: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockBalanceRecord {
  id: string;
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  quantity: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRecord {
  id: string;
  code: string;
  from_area_id: string;
  to_area_id: string;
  requested_by: string;
  approved_by: string | null;
  forklift_by: string | null;
  taken_away_by: string | null;
  status_id: string;
  note: string | null;
  rejected_reason: string | null;
  cancel_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  issued_at: string | null;
  received_at: string | null;
  completed_at: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  supply_id: string;
  unit_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  quantity_issued: number | null;
  note: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockTransactionRecord {
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
  reason_id: string | null;
  reason_note: string | null;
  note: string | null;
  created_by: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusRecord {
  id: string;
  code: OrderStatus;
  name: string;
  description: string | null;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockTransactionTypeRecord {
  id: string;
  code: StockTransactionType;
  name: string;
  effect: 'INCREASE' | 'DECREASE' | 'NEUTRAL';
  requires_reason: boolean;
  is_system: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentReasonRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_note: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRevisionActionRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRevisionRecord {
  id: string;
  order_id: string;
  action_id: string;
  old_status_id: string | null;
  new_status_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  created_by: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseRecordMap {
  users: UserRecord;
  roles: RoleRecord;
  areas: AreaRecord;
  supply_categories: SupplyCategoryRecord;
  units: UnitRecord;
  supplies: SupplyRecord;
  storage_locations: StorageLocationRecord;
  stock_balances: StockBalanceRecord;
  orders: OrderRecord;
  order_items: OrderItemRecord;
  stock_transactions: StockTransactionRecord;
  order_statuses: OrderStatusRecord;
  stock_transaction_types: StockTransactionTypeRecord;
  adjustment_reasons: AdjustmentReasonRecord;
  order_revision_actions: OrderRevisionActionRecord;
  order_revisions: OrderRevisionRecord;
}

export type FoundationTableName = keyof DatabaseRecordMap;
