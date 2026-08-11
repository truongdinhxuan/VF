import type { PaginatedListParams } from './pagination.types';

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionListParams extends PaginatedListParams {
  module?: string;
}
