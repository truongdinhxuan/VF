import type { PaginatedListParams } from './pagination.types';

export interface Unit {
  id: string;
  code: string;
  symbol: string;
  name: string;
  description: string | null;
  is_active: boolean;
  updated_at: string;
  created_at: string;
  is_deleted: boolean;
}

export interface UnitListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateUnitInput {
  code: string;
  symbol: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateUnitInput = Partial<CreateUnitInput>;
