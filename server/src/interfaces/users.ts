export interface UserInterface {
  email?: string;
  password?: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  vinfast_id: string;
  avatar_url: string;
  phone_number: string;
  position: number;
  managed_by: number;
  role: string;
  isverified: boolean;
  isdeleted: boolean;
  create_at: Date;
  updated_at: Date;
}
