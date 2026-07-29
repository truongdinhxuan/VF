import type { Area } from './areas';
import type { PaginatedListParams } from './pagination.types';

export interface StorageLocation {
  id: string;
  code: string;
  area_id: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
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
  description?: string | null;
  is_active?: boolean;
}

export type UpdateStorageLocationInput = Partial<CreateStorageLocationInput>;
export type StorageLocationOption = StorageLocation;
