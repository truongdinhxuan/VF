import { getProviders } from '../api/providers.service';
import { queryKeys } from '../lib/queryKeys';
import { useCrudResource } from './useCrudResource';

const loadProviders = async (signal: AbortSignal) =>
  (await getProviders(
    {
      page: 1,
      pageSize: 100,
      isActive: true,
      isDeleted: false,
      sortBy: 'code',
      sortOrder: 'asc',
    },
    signal,
  )).data;

export const useProviderLookup = () => useCrudResource(
  loadProviders,
  'Không thể tải danh sách Provider.',
  queryKeys.providers.lookup({ pageSize: 100, isActive: true, isDeleted: false }),
  { staleTime: 30 * 60 * 1000 },
);
