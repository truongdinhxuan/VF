import type { RoleName } from '../constants/roles';
import type { Area } from './areas';
import type { Position } from './positions';
import type { PaginatedListParams } from './pagination.types';

export interface RoleSummary {
  id: string;
  role_name: RoleName;
}

export type AreaSummary = Pick<Area, 'id' | 'code' | 'name'>;
export type PositionSummary = Position;

export interface UserRecord {
  id: string;
  vinfast_id: number;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
  role_id: string;
  position_id: string | null;
  area_id: string;
  managed_by_user_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
}

export interface UserProfile extends UserRecord {
  role: RoleSummary | RoleName | string | null;
  position?: PositionSummary | null;
  area: AreaSummary | null;
}

export interface IUser {
  token?: string;
  id?: string;
  email?: string;
  publicData: UserProfile;
}

export interface UserListParams extends PaginatedListParams {
  roleId?: string;
  positionId?: string;
  areaId?: string;
  isActive?: boolean;
}

export interface UserDataResponse {
  message: string;
  data: UserProfile;
}

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  vinfast_id: number;
  phone_number?: string | null;
  avatar_url?: string | null;
  role_id: string;
  position_id?: string | null;
  area_id: string;
  managed_by_user_id?: string | null;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  is_active?: boolean;
  is_verified?: boolean;
};

export interface UpdateUserPasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface UserMessageResponse {
  message: string;
}

export interface CreateUserResponse {
  message: string;
  data: {
    id: string;
    email: string;
    publicData: UserProfile;
  };
}
