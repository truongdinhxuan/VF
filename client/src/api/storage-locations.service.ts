import type { ApiEnvelope } from '../types/api';
import type {
  CreateStorageLocationInput,
  StorageLocation,
  StorageLocationListParams,
  UpdateStorageLocationInput,
} from '../types/storage-locations';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listStorageLocations = async (
  params: StorageLocationListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<StorageLocation>> =>
  instance.get<PaginatedResponse<StorageLocation>, PaginatedResponse<StorageLocation>>(
    'storage-locations',
    { params, signal },
  );

export const getStorageLocation = async (id: string): Promise<StorageLocation> =>
  unwrapData(
    await instance.get<ApiEnvelope<StorageLocation>, ApiEnvelope<StorageLocation>>(
      `storage-locations/${id}`,
    ),
  );

export const createStorageLocation = async (
  input: CreateStorageLocationInput,
): Promise<StorageLocation> =>
  unwrapData(
    await instance.post<ApiEnvelope<StorageLocation>, ApiEnvelope<StorageLocation>>(
      'storage-locations',
      input,
    ),
  );

export const updateStorageLocation = async (
  id: string,
  input: UpdateStorageLocationInput,
): Promise<StorageLocation> =>
  unwrapData(
    await instance.patch<ApiEnvelope<StorageLocation>, ApiEnvelope<StorageLocation>>(
      `storage-locations/${id}`,
      input,
    ),
  );

export const deactivateStorageLocation = async (id: string): Promise<StorageLocation> =>
  unwrapData(
    await instance.delete<ApiEnvelope<StorageLocation>, ApiEnvelope<StorageLocation>>(
      `storage-locations/${id}`,
    ),
  );
