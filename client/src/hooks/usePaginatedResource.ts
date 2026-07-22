import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/errors';
import type {
  PaginatedResponse,
  PaginationMeta,
  PaginationParams,
} from '../types/pagination.types';
import type { CrudFeedback } from './useCrudResource';

const emptyPagination = (query: PaginationParams): PaginationMeta => ({
  page: query.page,
  pageSize: query.pageSize,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

export const usePaginatedResource = <T, Q extends PaginationParams>({
  loader,
  initialQuery,
  loadErrorMessage,
}: {
  loader: (query: Q, signal: AbortSignal) => Promise<PaginatedResponse<T>>;
  initialQuery: Q;
  loadErrorMessage: string;
}) => {
  const [query, setQueryState] = useState<Q>(initialQuery);
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(() =>
    emptyPagination(initialQuery),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void loader(query, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (
          response.data.length === 0
          && response.pagination.totalPages > 0
          && query.page > response.pagination.totalPages
        ) {
          setQueryState((current) => ({
            ...current,
            page: response.pagination.totalPages,
          }));
          return;
        }
        setItems(response.data);
        setPagination(response.pagination);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(getApiErrorMessage(requestError, loadErrorMessage));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [loadErrorMessage, loader, query, revision]);

  const updateQuery = useCallback((patch: Partial<Q>, resetPage = true) => {
    setQueryState((current) => ({
      ...current,
      ...patch,
      ...(resetPage ? { page: 1 } : {}),
    }));
  }, []);

  const setPage = useCallback((page: number) => updateQuery({ page } as Partial<Q>, false), [updateQuery]);
  const setPageSize = useCallback(
    (pageSize: number) => updateQuery({ pageSize } as Partial<Q>, true),
    [updateQuery],
  );
  const reload = useCallback(() => setRevision((current) => current + 1), []);

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
    options: { removeCurrentItem?: boolean } = {},
  ): Promise<boolean> => {
    setMutating(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ type: 'success', message: successMessage });
      if (options.removeCurrentItem && items.length === 1 && query.page > 1) {
        setQueryState((current) => ({ ...current, page: current.page - 1 }));
      } else {
        reload();
      }
      return true;
    } catch (requestError) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(requestError, failureMessage),
      });
      return false;
    } finally {
      setMutating(false);
    }
  };

  return {
    query,
    items,
    pagination,
    loading,
    error,
    mutating,
    feedback,
    setFeedback,
    updateQuery,
    setPage,
    setPageSize,
    reload,
    runMutation,
  };
};
