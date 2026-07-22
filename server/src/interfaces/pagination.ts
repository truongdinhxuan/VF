export type SortOrder = 'asc' | 'desc';

export interface PaginationQuery {
  page?: number | string;
  pageSize?: number | string;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder | string;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface PaginatedResult<T, TMeta = never> {
  items: T[];
  pagination: PaginationMetadata;
  meta?: TMeta;
}
