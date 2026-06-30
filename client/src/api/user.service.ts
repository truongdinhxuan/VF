import { type IUser } from "../interfaces";
import instance from "./api.service";

// API lấy thông tin chi tiết của User đang đăng nhập dựa vào token
export const getMyProfile = async (): Promise<IUser> => {
    return instance.get(`auth/me`);
};
