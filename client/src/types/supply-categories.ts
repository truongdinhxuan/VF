import type { PaginatedListParams } from './pagination.types';

export interface SupplyCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface SupplyCategoryListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateSupplyCategoryInput {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateSupplyCategoryInput = Partial<CreateSupplyCategoryInput>;
