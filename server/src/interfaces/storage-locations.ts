export interface StorageLocationListQuery {
  area_id?: string;
  is_active?: string | boolean;
  q?: string;
}

export interface CreateStorageLocationBody {
  code: string;
  area_id: string;
  name?: string | null;
  is_active?: boolean;
}

export type UpdateStorageLocationBody = Partial<CreateStorageLocationBody>;
