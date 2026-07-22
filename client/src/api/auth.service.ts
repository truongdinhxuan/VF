import type { IUser } from "../types/users";
import instance from "./http";

export const login = async ({ email, password }: { email: string, password: string }): Promise<IUser> => {
    return instance.post(`auth/login`, { email, password })
}

export const logout = async () => {
    return instance.post(`auth/logout`)
}
