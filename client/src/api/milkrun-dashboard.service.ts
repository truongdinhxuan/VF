import type { ApiEnvelope } from '../types/api';
import type {
  MilkrunDashboard,
  MilkrunDashboardParams,
} from '../types/milkrun';
import instance from './http';
import { unwrapData } from './response';

export const getMilkrunDashboard = async (
  params: MilkrunDashboardParams = {},
  signal?: AbortSignal,
): Promise<MilkrunDashboard> => unwrapData(
  await instance.get<ApiEnvelope<MilkrunDashboard>, ApiEnvelope<MilkrunDashboard>>(
    'milkrun/dashboard',
    { params, signal },
  ),
);

