import type { ApiEnvelope } from '../types/api';
import type {
  CreateMilkrunTripInput,
  MilkrunTrip,
  MilkrunTripListParams,
} from '../types/milkrun';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import { unwrapData } from './response';

export const listMilkrunTrips = (
  params: MilkrunTripListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<MilkrunTrip>> =>
  instance.get<PaginatedResponse<MilkrunTrip>, PaginatedResponse<MilkrunTrip>>(
    'milkrun/trips',
    { params, signal },
  );

export const getMilkrunTrip = async (
  id: string,
  signal?: AbortSignal,
): Promise<MilkrunTrip> => unwrapData(
  await instance.get<ApiEnvelope<MilkrunTrip>, ApiEnvelope<MilkrunTrip>>(
    `milkrun/trips/${id}`,
    { signal },
  ),
);

export const createMilkrunTrip = async (
  input: CreateMilkrunTripInput,
): Promise<MilkrunTrip> => unwrapData(
  await instance.post<ApiEnvelope<MilkrunTrip>, ApiEnvelope<MilkrunTrip>>(
    'milkrun/trips',
    input,
  ),
);

const transition = async (
  id: string,
  action: 'start' | 'arrive' | 'cancel',
  body: Record<string, unknown> = {},
): Promise<MilkrunTrip> => unwrapData(
  await instance.post<ApiEnvelope<MilkrunTrip>, ApiEnvelope<MilkrunTrip>>(
    `milkrun/trips/${id}/${action}`,
    body,
  ),
);

export const startMilkrunTrip = (id: string) => transition(id, 'start');
export const arriveMilkrunTrip = (id: string) => transition(id, 'arrive');
export const cancelMilkrunTrip = (id: string, reason?: string) =>
  transition(id, 'cancel', { reason: reason?.trim() || null });

export {
  listMilkrunRacks,
  listMilkrunShops,
  listMilkrunTripStatuses,
  listMilkrunTripTypes,
} from './milkrun-master-data.service';
