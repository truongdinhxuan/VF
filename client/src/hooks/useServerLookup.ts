import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/errors';
import type { PaginatedResponse } from '../types/pagination.types';
import { useDebounce } from './useDebounce';

export const useServerLookup = <T,>({
  loader,
  errorMessage,
  delay = 400,
}: {
  loader: (search: string | undefined, signal: AbortSignal) => Promise<PaginatedResponse<T>>;
  errorMessage: string;
  delay?: number;
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, delay);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const normalizedSearch = debouncedSearch.trim() || undefined;

    void loader(normalizedSearch, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setItems(response.data);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError, errorMessage));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, errorMessage, loader]);

  return { search, setSearch, items, loading, error };
};
