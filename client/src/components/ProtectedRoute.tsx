import { Navigate, Outlet } from "react-router-dom";
import type { RoleName } from "../constants/roles";
import { useAuth } from "../context/AuthContext";

interface Props {
  allowedRoles?: readonly RoleName[];
}

export const ProtectedRoute = ({ allowedRoles }: Props) => {
  const { user, role, loading } = useAuth();
  const token = localStorage.getItem("access_token");

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Đang tải dữ liệu...</div>;
  }
  if (!token || !user) {
    return <Navigate to="/auth/login" replace />;
  }
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/403-unauthorized" replace />;
  }

  return <Outlet />;
};
