import instance from "./api.service";
import type { StorageLocationOption } from "../types/catalog";

interface StorageLocationsResponse {
  data: StorageLocationOption[];
}

export interface StorageLocationListParams {
  area_id?: string;
}

export const listStorageLocations = async (
  params: StorageLocationListParams = {},
): Promise<StorageLocationOption[]> => {
  const response = await instance.get<StorageLocationsResponse, StorageLocationsResponse>(
    "storage-locations",
    { params },
  );
  return response.data;
};
