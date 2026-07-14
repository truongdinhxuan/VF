import type { RoleName } from "./constants/roles";

export interface RoleSummary {
  id?: string;
  role_name: RoleName;
}

export interface AreaSummary {
  id: string;
  code: string;
  name: string;
}

export interface UserProfile {
  id?: string;
  email?: string;
  full_name?: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  vinfast_id?: string | number;
  role_id?: string | null;
  area_id?: string | null;
  role?: RoleSummary | RoleName | string | null;
  area?: AreaSummary | null;
  is_active?: boolean;
  created_at?: string | Date;
  updated_at?: string | Date;

  // Temporary compatibility for the existing legacy user page.
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  position?: number;
  managed_by?: number;
  create_at?: string | Date;
}

export interface IUser {
  token?: string;
  id?: string;
  email?: string;
  publicData: UserProfile;
}
