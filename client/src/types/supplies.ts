import type { PaginatedListParams } from './pagination.types';
import type { Provider } from './providers';

export interface SupplyCategorySummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface UnitSummary {
  id: string;
  code: string;
  symbol: string;
  name: string;
}

export interface Supply {
  id: string;
  code: string;
  short_text: string;
  translation_text: string | null;
  description: string | null;
  category_id: string;
  unit_id: string;
  is_active: boolean;
  is_deleted: boolean;
  min_stock?: number | null;
  max_stock?: number | null;
  safety_stock?: number | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  category?: SupplyCategorySummary | null;
  unit?: UnitSummary | null;
  providers: Provider[];
}

export interface SupplyListParams extends PaginatedListParams {
  categoryId?: string;
  unitId?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface CreateSupplyInput {
  code: string;
  short_text: string;
  translation_text?: string | null;
  category_id: string;
  unit_id: string;
  description?: string | null;
  min_stock?: number | null;
  max_stock?: number | null;
  safety_stock?: number | null;
  image_url?: string | null;
  is_active?: boolean;
  provider_ids: string[];
}

export type UpdateSupplyInput = Partial<Omit<CreateSupplyInput, 'provider_ids'>> & {
  provider_ids: string[];
};
export type SupplyOption = Pick<
  Supply,
  | 'id'
  | 'code'
  | 'short_text'
  | 'description'
  | 'unit_id'
  | 'unit'
  | 'category'
  | 'is_active'
  | 'is_deleted'
>;

export interface SupplyStackOption {
  set_per_qty: number;
  available_stack_quantity: number;
  available_total_set_quantity: number;
}

export interface SupplyStackOptionsParams {
  provider_id: string;
  area_id: string;
}
