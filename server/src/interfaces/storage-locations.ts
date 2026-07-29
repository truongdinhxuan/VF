import type { PaginationQuery } from './pagination';

export interface StorageLocationListQuery extends PaginationQuery {
  area_id?: string;
  areaId?: string;
  is_active?: string | boolean;
  isActive?: string | boolean;
  q?: string;
}

export interface CreateStorageLocationBody {
  code: string;
  area_id: string;
  name?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateStorageLocationBody = Partial<CreateStorageLocationBody>;
