export const USER_COLUMNS = [
  'id',
  'vinfast_id',
  'email',
  'phone_number',
  'avatar_url',
  'role_id',
  'position_id',
  'area_id',
  'managed_by_user_id',
  'is_active',
  'is_verified',
  'created_at',
  'updated_at',
  'first_name',
  'last_name',
] as const;

export interface LoginBody {
  email: string;
  password: string;
}

export interface CreateUserBody extends LoginBody {
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

export interface UpdateUserBody {
  email?: string;
  first_name?: string;
  last_name?: string;
  vinfast_id?: number;
  phone_number?: string | null;
  avatar_url?: string | null;
  role_id?: string;
  position_id?: string | null;
  area_id?: string;
  managed_by_user_id?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
}
