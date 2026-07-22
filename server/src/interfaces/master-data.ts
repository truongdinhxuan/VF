import type { RoleName } from '../domain/enums';
import type { PaginationQuery } from './pagination';

export interface ActiveListQuery extends PaginationQuery {
  is_active?: string | boolean;
  isActive?: string | boolean;
  q?: string;
}

export interface SearchListQuery extends PaginationQuery {
  q?: string;
}

export type RoleListQuery = PaginationQuery;

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
  description?: string | null;
  is_active?: boolean;
}

export type UpdateSupplyCategoryBody = Partial<CreateSupplyCategoryBody>;

export interface CreateUnitBody {
  code: string;
  symbol: string;
  is_active?: boolean;
}

export type UpdateUnitBody = Partial<CreateUnitBody>;
