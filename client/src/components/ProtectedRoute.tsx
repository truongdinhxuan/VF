import { Navigate, Outlet } from "react-router-dom";
import { PageSkeleton } from "./common/skeleton";
import { resolveRoleCode, type RoleCode } from "../constants/roles";
import { getRoleHomePath } from "../constants/workspaces";
import { useAuth } from "../context/AuthContext";
import { canAccessInternalData } from "../types/users";

interface Props {
  allowedRoles?: readonly RoleCode[];
  redirectRoleMismatchToHome?: boolean;
}

export const ProtectedRoute = ({
  allowedRoles,
  redirectRoleMismatchToHome = false,
}: Props) => {
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
    if (redirectRoleMismatchToHome && resolvedRole) {
      return <Navigate to={getRoleHomePath(resolvedRole)} replace />;
    }
    return <Navigate to="/403-unauthorized" replace />;
  }

  return <Outlet />;
};
