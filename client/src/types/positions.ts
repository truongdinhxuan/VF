export interface Position {
  id: string;
  position_name: string;
}

import type { PaginatedListParams } from './pagination.types';

export type PositionListParams = PaginatedListParams;

export interface CreatePositionInput {
  position_name: string;
}

export type UpdatePositionInput = CreatePositionInput;
