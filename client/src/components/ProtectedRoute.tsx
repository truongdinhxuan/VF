import { Navigate, Outlet } from "react-router-dom";
import { PageSkeleton } from "./common/skeleton";
import { resolveRoleName, type RoleName } from "../constants/roles";
import { useAuth } from "../context/AuthContext";

interface Props {
  allowedRoles?: readonly RoleName[];
}

export const ProtectedRoute = ({ allowedRoles }: Props) => {
  const { user, role, loading } = useAuth();
  const token = localStorage.getItem("access_token");
  const resolvedRole = role ?? resolveRoleName(user?.publicData?.role);

  if (loading) {
    return <PageSkeleton />;
  }
  if (!token || !user) {
    return <Navigate to="/auth/login" replace />;
  }
  if (allowedRoles && (!resolvedRole || !allowedRoles.includes(resolvedRole))) {
    return <Navigate to="/403-unauthorized" replace />;
  }

  return <Outlet />;
};
