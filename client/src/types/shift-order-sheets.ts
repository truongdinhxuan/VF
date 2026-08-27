import type { Order, OrderAreaSummary, OrderUserSummary } from './orders';
import type { PaginatedListParams } from './pagination.types';

export interface ShiftOrderSheetWorkShift {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
}

export interface ShiftOrderSheetSummary {
  id: string;
  area_id: string;
  work_shift_id: string;
  work_date: string;
  leader_id: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  area: OrderAreaSummary | null;
  work_shift: ShiftOrderSheetWorkShift | null;
  leader: OrderUserSummary | null;
  shift_start_at: string;
  shift_end_at: string;
  order_count: number;
  business_time_zone: 'Asia/Ho_Chi_Minh';
}

export interface ShiftOrderSheetDetail extends ShiftOrderSheetSummary {
  orders: Array<Order & { order_items?: Array<{ id: string }> }>;
}

export interface ShiftOrderSheetListParams extends PaginatedListParams {
  workDate?: string;
  workShiftId?: string;
  leaderId?: string;
  areaId?: string;
}

