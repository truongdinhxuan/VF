import type { PaginatedListParams } from './pagination.types';

export const ORDER_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PARTIAL_ISSUED",
  "ISSUED",
  "RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
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

export interface Order {
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
  order_items?: OrderItem[];
}

export interface OrderListParams extends PaginatedListParams {
  status?: OrderStatus;
  createdBy?: string;
  areaId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderItemInput {
  supply_id: string;
  quantity_requested: number;
  unit_id?: string;
  note?: string;
}

export interface CreateOrderInput {
  from_area_id: string;
  to_area_id: string;
  note?: string;
  order_list: OrderItemInput[];
}

export interface UpdateOrderInput {
  note?: string;
  order_list?: OrderItemInput[];
}

export interface ApproveOrderInput {
  items: Array<{ order_item_id: string; quantity_approved: number }>;
  note?: string;
}

export interface RejectOrderInput {
  rejected_reason: string;
}

export interface IssueOrderInput {
  items: Array<{
    order_item_id: string;
    issues: Array<{ storage_location_id: string; quantity: number }>;
  }>;
  forklift_by?: string;
  taken_away_by?: string;
}

export interface ReceiveOrderInput {
  taken_away_by?: string;
}

export interface CancelOrderInput {
  cancel_reason?: string;
}
