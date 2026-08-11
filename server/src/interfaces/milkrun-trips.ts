import type { PermissionCode } from '../domain/permission-codes';
import type { PaginationQuery } from './pagination';

export interface MilkrunTripActor {
  id: string;
  permissions: readonly PermissionCode[];
  isSystemAdmin: boolean;
}

export interface MilkrunTripItemBody {
  rack_id: string;
  quantity: number;
  note?: string | null;
}

export interface CreateMilkrunTripBody {
  shop_id: string;
  trip_type_id: string;
  attachment_url?: string | null;
  note?: string | null;
  items: MilkrunTripItemBody[];
}

export interface CancelMilkrunTripBody {
  reason?: string | null;
}

export interface MilkrunTripListQuery extends PaginationQuery {
  status?: string;
  statusId?: string;
  shopId?: string;
  tripTypeId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

