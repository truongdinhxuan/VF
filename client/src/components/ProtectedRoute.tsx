import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Props {
  allowedRoles?: string[]; // Mảng chứa các role hợp lệ, ví dụ: ['admin', 'teamlead']
}

export const ProtectedRoute = ({ allowedRoles }: Props) => {
  const { user, loading } = useAuth();
  const token = localStorage.getItem("access_token");

  // 1. Nếu Context vẫn đang gọi API lấy thông tin user, hiện màn hình Loading
  if (loading) {
    return <div>Đang tải dữ liệu...</div>; 
  }
  // console.log(user)
  // 2. Nếu không có token hoặc không có user đăng nhập, đá về trang Login
  if (!token || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Lấy role hiện tại của user (Dựa theo kiểu dữ liệu của bạn ở câu trước)
  const userRole = user.publicData?.role; 

  // 3. Nếu Route này yêu cầu phân quyền cụ thể (allowedRoles) và Role của user không khớp
  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    // Chuyển hướng người dùng về trang 403 (Không có quyền truy cập)
    return <Navigate to="/403-unauthorized" replace />;
  }

  // 4. Nếu thỏa mãn mọi điều kiện, cho phép truy cập trang con
  return <Outlet />;
};