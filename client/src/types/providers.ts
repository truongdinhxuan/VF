import type { PaginatedListParams } from './pagination.types';

export interface Provider {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderListParams extends PaginatedListParams {
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface CreateProviderInput {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateProviderInput = Partial<CreateProviderInput>;
