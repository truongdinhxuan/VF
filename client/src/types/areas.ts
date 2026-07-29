export interface Area {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

import type { PaginatedListParams } from './pagination.types';

export interface AreaListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateAreaInput {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateAreaInput = Partial<CreateAreaInput>;
export type AreaOption = Area;
