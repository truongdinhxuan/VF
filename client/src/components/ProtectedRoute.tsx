import { Navigate, Outlet } from "react-router-dom";
import { PageSkeleton } from "./common/skeleton";
import { useAuth } from "../context/AuthContext";
import { canAccessInternalData } from "../types/users";

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageSkeleton />;
  }
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }
  if (!canAccessInternalData(user.publicData)) {
    return <Navigate to="/403-unauthorized" replace />;
  }
  return <Outlet />;
};
