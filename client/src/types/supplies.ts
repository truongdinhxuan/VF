import type { PaginatedListParams } from './pagination.types';

export interface SupplyCategorySummary {
  id: string;
  code: string;
  description: string | null;
}

export interface UnitSummary {
  id: string;
  code: string;
  symbol: string;
}

export interface Supply {
  id: string;
  code: string;
  description: string | null;
  category_id: string;
  unit_id: string;
  is_active: boolean;
  is_deleted: boolean;
  min_stock?: number | null;
  max_stock?: number | null;
  safety_stock?: number | null;
  image_url?: string | null;
  created_at: string | null;
  updated_at: string | null;
  category?: SupplyCategorySummary | null;
  unit?: UnitSummary | null;
}

export interface SupplyListParams extends PaginatedListParams {
  categoryId?: string;
  unitId?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface CreateSupplyInput {
  code: string;
  category_id: string;
  unit_id: string;
  description?: string | null;
  min_stock?: number | null;
  max_stock?: number | null;
  safety_stock?: number | null;
  image_url?: string | null;
  is_active?: boolean;
}

export type UpdateSupplyInput = Partial<CreateSupplyInput>;
export type SupplyOption = Pick<
  Supply,
  'id' | 'code' | 'description' | 'unit_id' | 'is_active' | 'is_deleted'
>;
