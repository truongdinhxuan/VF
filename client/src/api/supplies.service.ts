import type { ApiEnvelope } from '../types/api';
import type {
  CreateSupplyInput,
  Supply,
  SupplyListParams,
  SupplyStackOption,
  SupplyStackOptionsParams,
  UpdateSupplyInput,
} from '../types/supplies';
import type { PaginatedResponse } from '../types/pagination.types';
import type { Provider } from '../types/providers';
import instance from './http';
import { unwrapData } from './response';

export const listSupplies = async (
  params: SupplyListParams = { isActive: true },
  signal?: AbortSignal,
): Promise<PaginatedResponse<Supply>> =>
  instance.get<PaginatedResponse<Supply>, PaginatedResponse<Supply>>('supplies', {
    params,
    signal,
  });

export const getSupply = async (id: string, signal?: AbortSignal): Promise<Supply> =>
  unwrapData(await instance.get<ApiEnvelope<Supply>, ApiEnvelope<Supply>>(`supplies/${id}`, { signal }));

export const getSupplyProviders = async (
  id: string,
  signal?: AbortSignal,
): Promise<Provider[]> =>
  unwrapData(
    await instance.get<ApiEnvelope<Provider[]>, ApiEnvelope<Provider[]>>(
      `supplies/${id}/providers`,
      { params: { isActive: true, isDeleted: false }, signal },
    ),
  );

export const getSupplyStackOptions = async (
  id: string,
  params: SupplyStackOptionsParams,
  signal?: AbortSignal,
): Promise<SupplyStackOption[]> =>
  unwrapData(
    await instance.get<ApiEnvelope<SupplyStackOption[]>, ApiEnvelope<SupplyStackOption[]>>(
      `supplies/${id}/stack-options`,
      { params, signal },
    ),
  );

export const createSupply = async (input: CreateSupplyInput): Promise<Supply> =>
  unwrapData(await instance.post<ApiEnvelope<Supply>, ApiEnvelope<Supply>>('supplies', input));

export const updateSupply = async (
  id: string,
  input: UpdateSupplyInput,
): Promise<Supply> =>
  unwrapData(
    await instance.patch<ApiEnvelope<Supply>, ApiEnvelope<Supply>>(`supplies/${id}`, input),
  );

export const deactivateSupply = async (id: string): Promise<Supply> =>
  unwrapData(
    await instance.delete<ApiEnvelope<Supply>, ApiEnvelope<Supply>>(`supplies/${id}`),
  );
