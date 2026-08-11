import type { PaginatedListParams } from './pagination.types';

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleListParams extends PaginatedListParams {
  isActive?: boolean;
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export type UpdateRoleInput = Partial<CreateRoleInput>;
