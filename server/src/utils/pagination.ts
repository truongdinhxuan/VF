import type {
  PaginatedResponse,
  PaginatedResult,
  PaginationMetadata,
  PaginationQuery,
  SortOrder,
} from '../interfaces/pagination';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 100;

export class PaginationValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'PaginationValidationError';
  }
}

export interface PaginationOptions<TSortBy extends string> {
  allowedSortBy: readonly TSortBy[];
  defaultSortBy: TSortBy;
  defaultSortOrder: SortOrder;
  legacySearch?: string;
}

export interface ParsedPagination<TSortBy extends string> {
  page: number;
  pageSize: number;
  search: string | null;
  sortBy: TSortBy;
  sortOrder: SortOrder;
  from: number;
  to: number;
}

const parseInteger = (
  value: number | string | undefined,
  field: 'page' | 'pageSize',
  fallback: number,
  maximum?: number,
): number => {
  if (value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new PaginationValidationError(
      `${field} phải là số nguyên lớn hơn hoặc bằng 1`,
    );
  }
  if (maximum !== undefined && parsed > maximum) {
    throw new PaginationValidationError(`${field} không được lớn hơn ${maximum}`);
  }
  return parsed;
};

export const normalizeSearch = (value: string | undefined): string | null => {
  if (value === undefined || !value.trim()) return null;
  const normalized = value.trim();
  if (normalized.length > MAX_SEARCH_LENGTH) {
    throw new PaginationValidationError(
      `search không được vượt quá ${MAX_SEARCH_LENGTH} ký tự`,
    );
  }
  if (/[(),]/.test(normalized)) {
    throw new PaginationValidationError('search chứa ký tự không được hỗ trợ');
  }
  return normalized.replaceAll('*', '\\*');
};

export const parsePagination = <TSortBy extends string>(
  query: PaginationQuery,
  options: PaginationOptions<TSortBy>,
): ParsedPagination<TSortBy> => {
  const page = parseInteger(query.page, 'page', DEFAULT_PAGE);
  const pageSize = parseInteger(
    query.pageSize,
    'pageSize',
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const requestedSortBy = query.sortBy ?? options.defaultSortBy;
  if (!options.allowedSortBy.includes(requestedSortBy as TSortBy)) {
    throw new PaginationValidationError(
      `sortBy phải thuộc danh sách: ${options.allowedSortBy.join(', ')}`,
    );
  }
  const sortOrder = query.sortOrder ?? options.defaultSortOrder;
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new PaginationValidationError('sortOrder chỉ nhận asc hoặc desc');
  }
  const from = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    search: normalizeSearch(query.search ?? options.legacySearch),
    sortBy: requestedSortBy as TSortBy,
    sortOrder,
    from,
    to: from + pageSize - 1,
  };
};

export const createPaginationMetadata = (
  page: number,
  pageSize: number,
  total: number,
): PaginationMetadata => {
  const safeTotal = Math.max(0, total);
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / pageSize);
  return {
    page,
    pageSize,
    total: safeTotal,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: totalPages > 0 && page > 1,
  };
};

export const createPaginatedResult = <T, TMeta = never>(
  items: T[],
  parsed: Pick<ParsedPagination<string>, 'page' | 'pageSize'>,
  total: number,
  meta?: TMeta,
): PaginatedResult<T, TMeta> => ({
  items,
  pagination: createPaginationMetadata(parsed.page, parsed.pageSize, total),
  ...(meta === undefined ? {} : { meta }),
});

interface PaginatedQueryError {
  code?: string;
  details?: string | null;
}

/**
 * PostgREST returns PGRST103/416 when an offset is beyond the filtered row
 * count. Its error details contain that exact filtered count, so preserve the
 * list contract without issuing a second count query.
 */
export const resolvePaginatedQueryResult = <T>(
  result: { data: T[] | null; error: unknown; count: number | null },
  parsed: Pick<ParsedPagination<string>, 'page' | 'pageSize'>,
): PaginatedResult<T> | null => {
  if (!result.error) {
    return createPaginatedResult(result.data ?? [], parsed, result.count ?? 0);
  }

  const error = result.error as PaginatedQueryError;
  if (error.code !== 'PGRST103') return null;
  const totalMatch = error.details?.match(/only\s+(\d+)\s+rows?/i);
  if (!totalMatch) return null;
  return createPaginatedResult([], parsed, Number(totalMatch[1]));
};

export const isPaginatedResult = (
  value: unknown,
): value is PaginatedResult<unknown, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PaginatedResult<unknown, unknown>>;
  return Array.isArray(candidate.items) && Boolean(candidate.pagination);
};

export const toPaginatedResponse = <T, TMeta = never>(
  result: PaginatedResult<T, TMeta>,
): PaginatedResponse<T> & { meta?: TMeta } => ({
  data: result.items,
  pagination: result.pagination,
  ...(result.meta === undefined ? {} : { meta: result.meta }),
});
