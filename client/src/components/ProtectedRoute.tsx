import { Navigate, Outlet } from "react-router-dom";
import { PageSkeleton } from "./common/skeleton";
import { resolveRoleCode, type RoleCode } from "../constants/roles";
import { useAuth } from "../context/AuthContext";
import { canAccessInternalData } from "../types/users";

interface Props {
  allowedRoles?: readonly RoleCode[];
}

export const ProtectedRoute = ({ allowedRoles }: Props) => {
  const { user, role, loading } = useAuth();
  const token = localStorage.getItem("access_token");
  const resolvedRole = role ?? resolveRoleCode(user?.publicData?.role);

  if (loading) {
    return <PageSkeleton />;
  }
  if (!token || !user) {
    return <Navigate to="/auth/login" replace />;
  }
  if (!canAccessInternalData(user.publicData)) {
    return <Navigate to="/403-unauthorized" replace />;
  }
  if (allowedRoles && (!resolvedRole || !allowedRoles.includes(resolvedRole))) {
    return <Navigate to="/403-unauthorized" replace />;
  }

  return <Outlet />;
};
