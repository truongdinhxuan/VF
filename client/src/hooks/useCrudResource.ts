import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { getApiErrorMessage } from '../api/errors';

export interface CrudFeedback {
  type: 'success' | 'error';
  message: string;
}

export const useCrudResource = <T,>(
  loader: (signal: AbortSignal) => Promise<T[]>,
  loadErrorMessage: string,
  queryKey: QueryKey,
  options: {
    staleTime?: number;
    invalidateQueryKeys?: readonly QueryKey[];
  } = {},
) => {
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const queryClient = useQueryClient();
  const resourceQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => loader(signal),
    staleTime: options.staleTime ?? 15 * 60 * 1000,
  });
  const resourceMutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
  });
  const reload = useCallback(
    () => resourceQuery.refetch().then(() => undefined),
    [resourceQuery],
  );

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ): Promise<boolean> => {
    setFeedback(null);
    try {
      await resourceMutation.mutateAsync(action);
      setFeedback({ type: 'success', message: successMessage });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        ...(options.invalidateQueryKeys ?? []).map((key) =>
          queryClient.invalidateQueries({ queryKey: key }),
        ),
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
    items: resourceQuery.data ?? [],
    loading: resourceQuery.isPending || resourceQuery.isFetching,
    error: resourceQuery.isError
      ? getApiErrorMessage(resourceQuery.error, loadErrorMessage)
      : null,
    mutating: resourceMutation.isPending,
    feedback,
    setFeedback,
    reload,
    runMutation,
  };
};
