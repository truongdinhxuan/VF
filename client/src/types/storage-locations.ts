import type { Area } from './areas';
import type { PaginatedListParams } from './pagination.types';

export interface StorageLocation {
  id: string;
  code: string;
  area_id: string;
  name: string | null;
  is_active: boolean;
  area?: Pick<Area, 'id' | 'code' | 'name' | 'is_active'> | null;
}

export interface StorageLocationListParams extends PaginatedListParams {
  areaId?: string;
  isActive?: boolean;
}

export interface CreateStorageLocationInput {
  code: string;
  area_id: string;
  name?: string | null;
  is_active?: boolean;
}

export type UpdateStorageLocationInput = Partial<CreateStorageLocationInput>;
export type StorageLocationOption = StorageLocation;
