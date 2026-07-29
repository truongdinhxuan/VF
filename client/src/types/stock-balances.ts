import type { Area } from './areas';
import type { StorageLocation } from './storage-locations';
import type { UnitSummary } from './supplies';
import type { PaginatedListParams } from './pagination.types';

export interface StockBalanceSupplySummary {
  id: string;
  code: string;
  description: string | null;
  min_stock: number | null;
  unit: UnitSummary | null;
}

export interface StockBalance {
  id: string;
  supply_id: string;
  area_id: string;
  storage_location_id: string;
  quantity: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  supply: StockBalanceSupplySummary | null;
  area: Pick<Area, 'id' | 'code' | 'name'> | null;
  storage_location: Pick<StorageLocation, 'id' | 'code' | 'name'> | null;
}

export interface StockBalanceListParams extends PaginatedListParams {
  supplyId?: string;
  areaId?: string;
  storageLocationId?: string;
}
