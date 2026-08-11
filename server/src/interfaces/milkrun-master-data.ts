import type { PaginationQuery } from './pagination';

export type MilkrunMasterResource =
  | 'racks'
  | 'shops'
  | 'trip_types'
  | 'trip_statuses'
  | 'vehicles'
  | 'stock_transaction_types'
  | 'adjustment_reasons';

export interface MilkrunMasterListQuery extends PaginationQuery {
  isActive?: boolean | string;
  isDeleted?: boolean | string;
}

export interface MilkrunBaseRecord {
  id: string;
  code: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MilkrunRackRecord extends MilkrunBaseRecord {
  name: string;
  image_url: string | null;
}

export interface MilkrunShopRecord extends MilkrunBaseRecord {
  name: string;
  description: string | null;
}

export interface MilkrunSystemLookupRecord extends MilkrunBaseRecord {
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface MilkrunTripTypeRecord extends MilkrunSystemLookupRecord {}

export interface MilkrunTripStatusRecord extends MilkrunSystemLookupRecord {
  sort_order: number;
}

export interface MilkrunVehicleRecord extends MilkrunBaseRecord {
  plate_number: string;
  driver_id: string | null;
  name: string | null;
}

export type MilkrunStockEffect = 'INCREASE' | 'DECREASE' | 'NEUTRAL';

export interface MilkrunStockTransactionTypeRecord extends MilkrunBaseRecord {
  name: string;
  effect: MilkrunStockEffect;
  requires_reason: boolean;
  is_system: boolean;
}

export interface MilkrunAdjustmentReasonRecord extends MilkrunBaseRecord {
  name: string;
  description: string | null;
}

export interface MilkrunRackBody {
  code: string;
  name: string;
  image_url?: string | null;
  is_active?: boolean;
}

export interface MilkrunShopBody {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface MilkrunTripTypeBody extends MilkrunShopBody {}

export interface MilkrunTripStatusBody extends MilkrunShopBody {
  sort_order: number;
}

export interface MilkrunVehicleBody {
  code: string;
  plate_number: string;
  driver_id?: string | null;
  name?: string | null;
  is_active?: boolean;
}

export interface MilkrunStockTransactionTypeBody {
  code: string;
  name: string;
  effect: MilkrunStockEffect;
  requires_reason?: boolean;
  is_active?: boolean;
}

export interface MilkrunAdjustmentReasonBody extends MilkrunShopBody {}

export type MilkrunMasterBody =
  | MilkrunRackBody
  | MilkrunShopBody
  | MilkrunTripTypeBody
  | MilkrunTripStatusBody
  | MilkrunVehicleBody
  | MilkrunStockTransactionTypeBody
  | MilkrunAdjustmentReasonBody;

export type MilkrunMasterUpdateBody = Partial<MilkrunMasterBody>;
