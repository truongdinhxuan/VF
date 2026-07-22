import type { PaginatedListParams } from './pagination.types';

export interface Unit {
  id: string;
  code: string;
  symbol: string;
  is_active: boolean;
  updated_at: string | null;
  created_at: string | null;
  is_deleted: boolean | null;
}

export interface UnitListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateUnitInput {
  code: string;
  symbol: string;
  is_active?: boolean;
}

export type UpdateUnitInput = Partial<CreateUnitInput>;
