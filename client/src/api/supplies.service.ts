import instance from "./api.service";
import type { SupplyOption } from "../types/catalog";

interface SuppliesResponse {
  data: SupplyOption[];
}

export interface SupplyListParams {
  q?: string;
  category_id?: string;
  is_active?: boolean;
}

export const listSupplies = async (
  params: SupplyListParams = { is_active: true },
): Promise<SupplyOption[]> => {
  const response = await instance.get<SuppliesResponse, SuppliesResponse>("supplies", { params });
  return response.data;
};
