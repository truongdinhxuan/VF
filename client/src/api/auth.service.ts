import type { IUser } from "../types/users";
import instance from "./http";

export interface LoginInput {
    vinfast_id: number;
    password: string;
}

export const login = async (input: LoginInput): Promise<IUser> => {
    return instance.post(`auth/login`, input)
}

export const logout = async () => {
    return instance.post(`auth/logout`)
}
