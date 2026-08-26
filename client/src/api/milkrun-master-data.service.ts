import type { ApiEnvelope } from '../types/api';
import type {
  MilkrunAdjustmentReason,
  MilkrunLookup,
  MilkrunLookupListParams,
  MilkrunRack,
  MilkrunRackInput,
  MilkrunShop,
  MilkrunShopInput,
  MilkrunStockTransactionType,
  MilkrunTripStatus,
  MilkrunTripStatusRecord,
  MilkrunTripStatusInput,
  MilkrunTripType,
  MilkrunTripTypeInput,
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

const getMaster = async <T>(path: MilkrunMasterPath, id: string): Promise<T> =>
  unwrapData(await instance.get<ApiEnvelope<T>, ApiEnvelope<T>>(`milkrun/${path}/${id}`));

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
export const getMilkrunShopById = (id: string) =>
  getMaster<MilkrunShop>('shops', id);
export const createMilkrunShop = (input: MilkrunShopInput) =>
  createMaster<MilkrunShop, MilkrunShopInput>('shops', input);
export const updateMilkrunShop = (id: string, input: Partial<MilkrunShopInput>) =>
  updateMaster<MilkrunShop, Partial<MilkrunShopInput>>('shops', id, input);
export const deactivateMilkrunShop = (id: string) =>
  deactivateMaster<MilkrunShop>('shops', id);
export const listMilkrunTripTypes = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunTripType>('trip-types', params, signal);
export const getMilkrunTripTypeById = (id: string) =>
  getMaster<MilkrunTripType>('trip-types', id);
export const createMilkrunTripType = (input: MilkrunTripTypeInput) =>
  createMaster<MilkrunTripType, MilkrunTripTypeInput>('trip-types', input);
export const updateMilkrunTripType = (id: string, input: Partial<MilkrunTripTypeInput>) =>
  updateMaster<MilkrunTripType, Partial<MilkrunTripTypeInput>>('trip-types', id, input);
export const deactivateMilkrunTripType = (id: string) =>
  deactivateMaster<MilkrunTripType>('trip-types', id);
export const listMilkrunTripStatuses = (params?: MilkrunLookupListParams, signal?: AbortSignal) =>
  listMaster<MilkrunTripStatusRecord>('trip-statuses', params, signal);
export const getMilkrunTripStatusById = (id: string) =>
  getMaster<MilkrunTripStatusRecord>('trip-statuses', id);
export const createMilkrunTripStatus = (input: MilkrunTripStatusInput) =>
  createMaster<MilkrunTripStatusRecord, MilkrunTripStatusInput>('trip-statuses', input);
export const updateMilkrunTripStatus = (id: string, input: Partial<MilkrunTripStatusInput>) =>
  updateMaster<MilkrunTripStatusRecord, Partial<MilkrunTripStatusInput>>('trip-statuses', id, input);
export const deactivateMilkrunTripStatus = (id: string) =>
  deactivateMaster<MilkrunTripStatusRecord>('trip-statuses', id);
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
