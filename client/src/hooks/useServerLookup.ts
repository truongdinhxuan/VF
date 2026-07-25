import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { getApiErrorMessage } from '../api/errors';
import type { PaginatedResponse } from '../types/pagination.types';
import { useDebounce } from './useDebounce';

export const useServerLookup = <T,>({
  loader,
  queryKey,
  errorMessage,
  delay = 400,
  enabled = true,
}: {
  loader: (search: string | undefined, signal: AbortSignal) => Promise<PaginatedResponse<T>>;
  queryKey: (search: string | undefined) => QueryKey;
  errorMessage: string;
  delay?: number;
  enabled?: boolean;
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, delay);
  const normalizedSearch = debouncedSearch.trim() || undefined;
  const lookupQuery = useQuery({
    queryKey: queryKey(normalizedSearch),
    queryFn: ({ signal }) => loader(normalizedSearch, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  return {
    search,
    setSearch,
    items: lookupQuery.data?.data ?? [],
    loading: enabled && (lookupQuery.isPending || lookupQuery.isFetching),
    error: lookupQuery.isError
      ? getApiErrorMessage(lookupQuery.error, errorMessage)
      : null,
  };
};
