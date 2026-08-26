import instance from './http';
import { unwrapData } from './response';
import type { ApiEnvelope } from '../types/api';
import type {
  InventoryDiscrepancy,
  ResolveInventoryDiscrepancyInput,
} from '../types/inventory-discrepancies';

export const resolveInventoryDiscrepancy = async (
  id: string,
  input: ResolveInventoryDiscrepancyInput,
): Promise<InventoryDiscrepancy> => unwrapData(
  await instance.post<
    ApiEnvelope<InventoryDiscrepancy>,
    ApiEnvelope<InventoryDiscrepancy>
  >(`inventory-discrepancies/${id}/resolve`, input),
);
