import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/errors';

export interface CrudFeedback {
  type: 'success' | 'error';
  message: string;
}

export const useCrudResource = <T,>(
  loader: () => Promise<T[]>,
  loadErrorMessage: string,
) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await loader());
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, loadErrorMessage));
    } finally {
      setLoading(false);
    }
  }, [loader, loadErrorMessage]);

  useEffect(() => {
    let active = true;
    void loader()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError, loadErrorMessage));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loader, loadErrorMessage]);

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ): Promise<boolean> => {
    setMutating(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ type: 'success', message: successMessage });
      await reload();
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
    items,
    loading,
    error,
    mutating,
    feedback,
    setFeedback,
    reload,
    runMutation,
  };
};
