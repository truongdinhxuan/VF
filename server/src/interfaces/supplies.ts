import type { PaginationQuery } from './pagination';

export interface SupplyListQuery extends PaginationQuery {
  q?: string;
  category_id?: string;
  categoryId?: string;
  unitId?: string;
  is_active?: string | boolean;
  isActive?: string | boolean;
  isDeleted?: string | boolean;
}

export interface SupplyProviderListQuery {
  isActive?: string | boolean;
  isDeleted?: string | boolean;
}

export interface CreateSupplyBody {
  code: string;
  short_text: string;
  translation_text?: string | null;
  description?: string | null;
  category_id: string;
  unit_id: string;
  min_stock?: number | null;
  max_stock?: number | null;
  safety_stock?: number | null;
  image_url?: string | null;
  is_active?: boolean;
  provider_ids: string[];
}

export interface UpdateSupplyBody
  extends Partial<Omit<CreateSupplyBody, 'provider_ids'>> {
  provider_ids: string[];
}
