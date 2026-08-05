import type { PaginationQuery } from './pagination';

export interface ProviderListQuery extends PaginationQuery {
  isActive?: string | boolean;
  isDeleted?: string | boolean;
}

export interface CreateProviderBody {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateProviderBody = Partial<CreateProviderBody>;
