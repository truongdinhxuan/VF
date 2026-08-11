import type { ApiEnvelope } from '../types/api';
import type {
  MilkrunAdjustmentReason,
  MilkrunLookup,
  MilkrunLookupListParams,
  MilkrunRack,
  MilkrunRackInput,
  MilkrunShop,
  MilkrunStockTransactionType,
  MilkrunTripStatus,
  MilkrunTripStatusRecord,
  MilkrunTripType,
  MilkrunVehicle,
  MilkrunVehicleInput,
} from '../types/milkrun';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

type MilkrunMasterPath =
  | 'racks'
  | 'shops'
  | 'trip-types'
  | 'trip-statuses'
  | 'vehicles'
  | 'stock-transaction-types'
  | 'adjustment-reasons';

const listMaster = <T>(
  path: MilkrunMasterPath,
  params: MilkrunLookupListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<T>> => instance.get(`milkrun/${path}`, { params, signal });

const createMaster = async <T, TInput>(path: MilkrunMasterPath, input: TInput): Promise<T> =>
  unwrapData(await instance.post<ApiEnvelope<T>, ApiEnvelope<T>>(`milkrun/${path}`, input));

const updateMaster = async <T, TInput>(path: MilkrunMasterPath, id: string, input: TInput): Promise<T> =>
  unwrapData(await instance.patch<ApiEnvelope<T>, ApiEnvelope<T>>(`milkrun/${path}/${id}`, input));

const deactivateMaster = async <T>(path: MilkrunMasterPath, id: string): Promise<T> =>
  unwrapData(await instance.patch<ApiEnvelope<T>, ApiEnvelope<T>>(`milkrun/${path}/${id}/deactivate`));

export const listMilkrunRacks = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunRack>('racks', params, signal);
export const createMilkrunRack = (input: MilkrunRackInput) =>
  createMaster<MilkrunRack, MilkrunRackInput>('racks', input);
export const updateMilkrunRack = (id: string, input: Partial<MilkrunRackInput>) =>
  updateMaster<MilkrunRack, Partial<MilkrunRackInput>>('racks', id, input);
export const deactivateMilkrunRack = (id: string) =>
  deactivateMaster<MilkrunRack>('racks', id);

export const listMilkrunShops = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunShop>('shops', params, signal);
export const listMilkrunTripTypes = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunTripType>('trip-types', params, signal);
export const listMilkrunTripStatuses = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunTripStatusRecord>('trip-statuses', params, signal);
export const listMilkrunVehicles = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunVehicle>('vehicles', params, signal);
export const updateMilkrunVehicle = (id: string, input: MilkrunVehicleInput) =>
  updateMaster<MilkrunVehicle, MilkrunVehicleInput>('vehicles', id, input);

export const listMilkrunStockTransactionTypes = (
  params?: MilkrunLookupListParams,
  signal?: AbortSignal,
) => listMaster<MilkrunStockTransactionType>('stock-transaction-types', params, signal);

export const listMilkrunAdjustmentReasons = (
  params?: MilkrunLookupListParams,
  signal?: AbortSignal,
) => listMaster<MilkrunAdjustmentReason>('adjustment-reasons', params, signal);

// Compatibility exports for existing Trip pages.
export type { MilkrunLookup, MilkrunTripStatus };
