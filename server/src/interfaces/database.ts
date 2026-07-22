import type {
  OrderStatus,
  RoleName,
  StockTransactionType,
} from '../domain/enums';

export interface RoleRecord {
  id: string;
  role_name: RoleName;
}

export interface PositionRecord {
  id: string;
  position_name: string;
}

export interface AreaRecord {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface UserRecord {
  id: string;
  vinfast_id: number;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
  role_id: string;
  position_id: string | null;
  area_id: string;
  managed_by_user_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
}

export interface SupplyCategoryRecord {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  is_deleted: boolean | null;
}

export interface UnitRecord {
  id: string;
  code: string;
  symbol: string;
  is_active: boolean;
  updated_at: string | null;
  created_at: string | null;
  is_deleted: boolean | null;
}

export interface SupplyRecord {
  id: string;
  code: string;
  description: string | null;
  category_id: string;
  unit_id: string;
  min_stock: number | null;
  max_stock: number | null;
  safety_stock: number | null;
  image_url: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface StorageLocationRecord {
  id: string;
  code: string;
  area_id: string;
  name: string | null;
  is_active: boolean;
}

export interface StockBalanceRecord {
  id: string;
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface OrderRecord {
  id: string;
  code: string;
  planning_id: string | null;
  from_area_id: string;
  to_area_id: string;
  requested_by: string;
  approved_by: string | null;
  forklift_by: string | null;
  taken_away_by: string | null;
  status: OrderStatus;
  note: string | null;
  rejected_reason: string | null;
  cancel_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  issued_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  planning_item_id: string | null;
  supply_id: string;
  unit_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  quantity_issued: number | null;
  note: string | null;
}

export interface StockTransactionRecord {
  id: string;
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  order_id: string | null;
  order_item_id: string | null;
  type: StockTransactionType;
  quantity: number;
  before_quantity: number;
  after_quantity: number;
  reason: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface DatabaseRecordMap {
  users: UserRecord;
  roles: RoleRecord;
  positions: PositionRecord;
  areas: AreaRecord;
  supply_categories: SupplyCategoryRecord;
  units: UnitRecord;
  supplies: SupplyRecord;
  storage_locations: StorageLocationRecord;
  stock_balances: StockBalanceRecord;
  stock_transactions: StockTransactionRecord;
}

export type FoundationTableName = keyof DatabaseRecordMap;
