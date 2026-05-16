import { type IUser } from "../interfaces"
import instance from "./api.service"

export const login = async ({ email, password }: { email: string, password: string }): Promise<IUser> => {
    return instance.post(`auth/login`, { email, password })
}

export const register = async (data: IUser) => {
    return instance.post(`auth/register`, data)
}

export const logout = async () => {
    return instance.post(`auth/logout`)
}