import type { ApiEnvelope } from '../types/api';
import type { CreateUnitInput, Unit, UnitListParams, UpdateUnitInput } from '../types/units';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listUnits = async (
  params: UnitListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<Unit>> =>
  instance.get<PaginatedResponse<Unit>, PaginatedResponse<Unit>>('units', { params, signal });

export const getUnit = async (id: string): Promise<Unit> =>
  unwrapData(await instance.get<ApiEnvelope<Unit>, ApiEnvelope<Unit>>(`units/${id}`));

export const createUnit = async (input: CreateUnitInput): Promise<Unit> =>
  unwrapData(await instance.post<ApiEnvelope<Unit>, ApiEnvelope<Unit>>('units', input));

export const updateUnit = async (id: string, input: UpdateUnitInput): Promise<Unit> =>
  unwrapData(await instance.patch<ApiEnvelope<Unit>, ApiEnvelope<Unit>>(`units/${id}`, input));

export const deactivateUnit = async (id: string): Promise<Unit> =>
  unwrapData(await instance.delete<ApiEnvelope<Unit>, ApiEnvelope<Unit>>(`units/${id}`));
