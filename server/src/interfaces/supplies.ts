export interface SupplyListQuery {
  q?: string;
  category_id?: string;
  is_active?: string | boolean;
}

export interface CreateSupplyBody {
  code: string;
  short_text: string;
  translator_text?: string | null;
  description?: string | null;
  category_id: string;
  unit_id: string;
  min_stock?: number | null;
  max_stock?: number | null;
  safety_stock?: number | null;
  image_url?: string | null;
  is_active?: boolean;
}

export type UpdateSupplyBody = Partial<CreateSupplyBody>;
