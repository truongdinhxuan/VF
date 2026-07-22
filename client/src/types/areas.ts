export interface Area {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

import type { PaginatedListParams } from './pagination.types';

export interface AreaListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateAreaInput {
  code: string;
  name: string;
  is_active?: boolean;
}

export type UpdateAreaInput = Partial<CreateAreaInput>;
export type AreaOption = Area;
