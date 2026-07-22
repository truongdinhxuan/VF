import type { ApiEnvelope } from '../types/api';
import type {
  Area,
  AreaListParams,
  CreateAreaInput,
  UpdateAreaInput,
} from '../types/areas';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listAreas = async (
  params: AreaListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<Area>> =>
  instance.get<PaginatedResponse<Area>, PaginatedResponse<Area>>('areas', { params, signal });

export const getArea = async (id: string): Promise<Area> =>
  unwrapData(await instance.get<ApiEnvelope<Area>, ApiEnvelope<Area>>(`areas/${id}`));

export const createArea = async (input: CreateAreaInput): Promise<Area> =>
  unwrapData(await instance.post<ApiEnvelope<Area>, ApiEnvelope<Area>>('areas', input));

export const updateArea = async (id: string, input: UpdateAreaInput): Promise<Area> =>
  unwrapData(await instance.patch<ApiEnvelope<Area>, ApiEnvelope<Area>>(`areas/${id}`, input));

export const deactivateArea = async (id: string): Promise<Area> =>
  unwrapData(await instance.delete<ApiEnvelope<Area>, ApiEnvelope<Area>>(`areas/${id}`));
