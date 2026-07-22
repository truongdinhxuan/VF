import type { ApiEnvelope } from '../types/api';
import type {
  CreatePositionInput,
  Position,
  PositionListParams,
  UpdatePositionInput,
} from '../types/positions';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listPositions = async (
  params: PositionListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<Position>> =>
  instance.get<PaginatedResponse<Position>, PaginatedResponse<Position>>('positions', {
    params,
    signal,
  });

export const getPosition = async (id: string): Promise<Position> =>
  unwrapData(await instance.get<ApiEnvelope<Position>, ApiEnvelope<Position>>(`positions/${id}`));

export const createPosition = async (input: CreatePositionInput): Promise<Position> =>
  unwrapData(
    await instance.post<ApiEnvelope<Position>, ApiEnvelope<Position>>('positions', input),
  );

export const updatePosition = async (
  id: string,
  input: UpdatePositionInput,
): Promise<Position> =>
  unwrapData(
    await instance.patch<ApiEnvelope<Position>, ApiEnvelope<Position>>(`positions/${id}`, input),
  );

export const deletePosition = async (id: string): Promise<Position> =>
  unwrapData(
    await instance.delete<ApiEnvelope<Position>, ApiEnvelope<Position>>(`positions/${id}`),
  );
