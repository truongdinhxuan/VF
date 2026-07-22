import type { PaginatedListParams } from './pagination.types';

export interface SupplyCategory {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  is_deleted: boolean | null;
}

export interface SupplyCategoryListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateSupplyCategoryInput {
  code: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateSupplyCategoryInput = Partial<CreateSupplyCategoryInput>;
