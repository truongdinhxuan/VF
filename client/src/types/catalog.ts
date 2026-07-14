export interface SupplyOption {
  id: string;
  code: string;
  short_text: string;
  unit_id: string;
  is_active: boolean;
  is_deleted?: boolean;
}

export interface AreaOption {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface StorageLocationOption {
  id: string;
  code: string;
  area_id: string;
  name: string | null;
  is_active: boolean;
}
