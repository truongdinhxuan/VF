export interface IUser {
  token: string,
  publicData: {
    email?: string,
    password?: string,
    first_name: string,
    middle_name: string,
    last_name: string,
    vinfast_id: string,
    avatar_url: string,
    phone_number: string,
    position: number, 
    managed_by: number,
    role: string,
    create_at: Date,
    updated_at: Date
  }
}