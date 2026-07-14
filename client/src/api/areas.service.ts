import instance from "./api.service";
import type { AreaOption } from "../types/catalog";

interface AreasResponse {
  data: AreaOption[];
}

export const listAreas = async (): Promise<AreaOption[]> => {
  const response = await instance.get<AreasResponse, AreasResponse>("areas");
  return response.data;
};
