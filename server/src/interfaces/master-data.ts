import type { RoleName } from '../domain/enums';

export interface ActiveListQuery {
  is_active?: string | boolean;
  q?: string;
}

export interface SearchListQuery {
  q?: string;
}

export interface CreateRoleBody {
  role_name: RoleName;
}

export type UpdateRoleBody = Partial<CreateRoleBody>;

export interface CreatePositionBody {
  position_name: string;
}

export type UpdatePositionBody = Partial<CreatePositionBody>;

export interface CreateAreaBody {
  code: string;
  name: string;
  is_active?: boolean;
}

export type UpdateAreaBody = Partial<CreateAreaBody>;

export interface CreateSupplyCategoryBody {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateSupplyCategoryBody = Partial<CreateSupplyCategoryBody>;

export interface CreateUnitBody {
  code: string;
  symbol: string;
  name?: string | null;
  is_active?: boolean;
}

export type UpdateUnitBody = Partial<CreateUnitBody>;
