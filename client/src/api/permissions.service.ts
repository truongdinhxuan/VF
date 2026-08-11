import type { PaginatedResponse } from '../types/pagination.types';
import type { Permission, PermissionListParams } from '../types/permissions';
import instance from './http';

export const listPermissions = async (
  params: PermissionListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<Permission>> =>
  instance.get<PaginatedResponse<Permission>, PaginatedResponse<Permission>>(
    'permissions', { params, signal },
  );
