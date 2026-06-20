import { type IUser } from "../interfaces";
import instance from "./api.service";

// API lấy thông tin chi tiết của User đang đăng nhập dựa vào token
export const getProfile = async (): Promise<IUser> => {
    return instance.get(`auth/me`); // Hoặc `auth/profile` tùy thuộc vào Backend của bạn
};