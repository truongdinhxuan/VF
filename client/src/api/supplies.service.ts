import type { ApiEnvelope } from '../types/api';
import type {
  CreateSupplyInput,
  Supply,
  SupplyListParams,
  UpdateSupplyInput,
} from '../types/supplies';
import type { PaginatedResponse } from '../types/pagination.types';
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

export const getSupply = async (id: string): Promise<Supply> =>
  unwrapData(await instance.get<ApiEnvelope<Supply>, ApiEnvelope<Supply>>(`supplies/${id}`));

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
