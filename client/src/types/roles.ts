import type { RoleName } from '../constants/roles';
import type { PaginatedListParams } from './pagination.types';

export interface Role {
  id: string;
  role_name: RoleName;
}

export interface RoleListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateRoleInput {
  role_name: RoleName;
}

export type UpdateRoleInput = CreateRoleInput;
