import type { IUser } from "../types/users";
import instance from "./http";

export const getMyProfile = async (): Promise<IUser> => instance.get("auth/me");

export const getUsers = async (): Promise<IUser[]> => instance.get("users");
