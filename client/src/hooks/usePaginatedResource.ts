import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';
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
  queryKey,
  invalidateQueryKeys = [],
}: {
  loader: (query: Q, signal: AbortSignal) => Promise<PaginatedResponse<T>>;
  initialQuery: Q;
  loadErrorMessage: string;
  queryKey: QueryKey;
  invalidateQueryKeys?: readonly QueryKey[];
}) => {
  const [query, setQueryState] = useState<Q>(initialQuery);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const queryClient = useQueryClient();
  const resourceRootKey = queryKey.slice(0, 1);
  const resourceQuery = useQuery({
    queryKey: [...queryKey, query],
    queryFn: ({ signal }) => loader(query, signal),
    placeholderData: keepPreviousData,
  });
  const resourceMutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
  });
  const items = resourceQuery.data?.data ?? [];
  const pagination = resourceQuery.data?.pagination ?? emptyPagination(query);
  const loading = resourceQuery.isPending || resourceQuery.isFetching;
  const error = resourceQuery.isError
    ? getApiErrorMessage(resourceQuery.error, loadErrorMessage)
    : null;

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
  const reload = useCallback(
    () => resourceQuery.refetch().then(() => undefined),
    [resourceQuery],
  );

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
    options: { removeCurrentItem?: boolean } = {},
  ): Promise<boolean> => {
    setFeedback(null);
    try {
      await resourceMutation.mutateAsync(action);
      setFeedback({ type: 'success', message: successMessage });
      if (options.removeCurrentItem && items.length === 1 && query.page > 1) {
        setQueryState((current) => ({ ...current, page: current.page - 1 }));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourceRootKey }),
        ...invalidateQueryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
      ]);
      return true;
    } catch (requestError) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(requestError, failureMessage),
      });
      return false;
    }
  };

  return {
    query,
    items,
    pagination,
    loading,
    error,
    mutating: resourceMutation.isPending,
    feedback,
    setFeedback,
    updateQuery,
    setPage,
    setPageSize,
    reload,
    runMutation,
  };
};
