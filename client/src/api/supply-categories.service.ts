import type { ApiEnvelope } from '../types/api';
import type {
  CreateSupplyCategoryInput,
  SupplyCategory,
  SupplyCategoryListParams,
  UpdateSupplyCategoryInput,
} from '../types/supply-categories';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listSupplyCategories = async (
  params: SupplyCategoryListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<SupplyCategory>> =>
  instance.get<PaginatedResponse<SupplyCategory>, PaginatedResponse<SupplyCategory>>(
    'supply-categories',
    { params, signal },
  );

export const getSupplyCategory = async (id: string): Promise<SupplyCategory> =>
  unwrapData(
    await instance.get<ApiEnvelope<SupplyCategory>, ApiEnvelope<SupplyCategory>>(
      `supply-categories/${id}`,
    ),
  );

export const createSupplyCategory = async (
  input: CreateSupplyCategoryInput,
): Promise<SupplyCategory> =>
  unwrapData(
    await instance.post<ApiEnvelope<SupplyCategory>, ApiEnvelope<SupplyCategory>>(
      'supply-categories',
      input,
    ),
  );

export const updateSupplyCategory = async (
  id: string,
  input: UpdateSupplyCategoryInput,
): Promise<SupplyCategory> =>
  unwrapData(
    await instance.patch<ApiEnvelope<SupplyCategory>, ApiEnvelope<SupplyCategory>>(
      `supply-categories/${id}`,
      input,
    ),
  );

export const deactivateSupplyCategory = async (id: string): Promise<SupplyCategory> =>
  unwrapData(
    await instance.delete<ApiEnvelope<SupplyCategory>, ApiEnvelope<SupplyCategory>>(
      `supply-categories/${id}`,
    ),
  );
