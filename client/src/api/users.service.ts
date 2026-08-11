import type {
  CreateUserInput,
  CreateUserResponse,
  IUser,
  UpdateUserInput,
  UpdateUserPasswordInput,
  UserDataResponse,
  UserListParams,
  UserMessageResponse,
  UserProfile,
} from '../types/users';
import type { PaginatedResponse } from '../types/pagination.types';
import instance from './http';
import type { Role } from '../types/roles';
import type { ApiEnvelope } from '../types/api';
import { unwrapData } from './response';

export const getMyProfile = async (): Promise<IUser> => instance.get('auth/me');

export const getUsers = async (
  params: UserListParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<UserProfile>> => instance.get('users', { params, signal });

export const getUser = async (id: string): Promise<UserProfile> => {
  const response = await instance.get<UserDataResponse, UserDataResponse>(`users/${id}`);
  return response.data;
};

export const createUser = async (input: CreateUserInput): Promise<CreateUserResponse> =>
  instance.post('users', input);

export const updateUser = async (
  id: string,
  input: UpdateUserInput,
): Promise<UserProfile> => {
  const response = await instance.patch<UserDataResponse, UserDataResponse>(`users/${id}`, input);
  return response.data;
};

export const deactivateUser = async (id: string): Promise<UserProfile> => {
  const response = await instance.delete<UserDataResponse, UserDataResponse>(`users/${id}`);
  return response.data;
};

export const updateUserPassword = async (
  id: string,
  input: UpdateUserPasswordInput,
): Promise<UserMessageResponse> =>
  instance.patch<UserMessageResponse, UserMessageResponse>(`users/${id}/password`, input);

export const getUserRoles = async (id: string): Promise<Role[]> =>
  unwrapData(await instance.get<ApiEnvelope<Role[]>, ApiEnvelope<Role[]>>(`users/${id}/roles`));

export const replaceUserRoles = async (id: string, roleIds: string[]): Promise<Role[]> =>
  unwrapData(await instance.put<ApiEnvelope<Role[]>, ApiEnvelope<Role[]>>(
    `users/${id}/roles`, { role_ids: roleIds },
  ));
