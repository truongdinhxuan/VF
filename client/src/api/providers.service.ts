import type { ApiEnvelope } from '../types/api';
import type { PaginatedResponse } from '../types/pagination.types';
import type {
  CreateProviderInput,
  Provider,
  ProviderListParams,
  UpdateProviderInput,
} from '../types/providers';
import instance from './http';
import { unwrapData } from './response';

export const getProviders = async (
  params: ProviderListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<Provider>> =>
  instance.get<PaginatedResponse<Provider>, PaginatedResponse<Provider>>(
    'providers',
    { params, signal },
  );

export const getProviderById = async (
  id: string,
  signal?: AbortSignal,
): Promise<Provider> =>
  unwrapData(
    await instance.get<ApiEnvelope<Provider>, ApiEnvelope<Provider>>(
      `providers/${id}`,
      { signal },
    ),
  );

export const createProvider = async (
  input: CreateProviderInput,
): Promise<Provider> =>
  unwrapData(
    await instance.post<ApiEnvelope<Provider>, ApiEnvelope<Provider>>(
      'providers',
      input,
    ),
  );

export const updateProvider = async (
  id: string,
  input: UpdateProviderInput,
): Promise<Provider> =>
  unwrapData(
    await instance.patch<ApiEnvelope<Provider>, ApiEnvelope<Provider>>(
      `providers/${id}`,
      input,
    ),
  );

export const deactivateProvider = async (id: string): Promise<Provider> =>
  unwrapData(
    await instance.patch<ApiEnvelope<Provider>, ApiEnvelope<Provider>>(
      `providers/${id}/deactivate`,
    ),
  );
