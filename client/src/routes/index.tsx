import { lazy } from "react";
import { Navigate, type RouteObject, useRoutes } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { ROLE_NAMES, STOCK_MUTATOR_ROLES } from "../constants/roles";
import { adminRoutes } from "./admin.routes";
import { authRoutes } from "./auth.routes";

const HomePage = lazy(() => import("../pages/HomePage"));
const UnauthorizedPage = lazy(() => import("../pages/error/UnauthorizedPage"));

export const AppRoutes = () => {
  const routes: RouteObject[] = [
    { path: "/", element: <HomePage /> },
    authRoutes,
    { path: "/403-unauthorized", element: <UnauthorizedPage /> },
    {
      element: <ProtectedRoute allowedRoles={ROLE_NAMES} />,
      children: [adminRoutes],
    },
    {
      element: <ProtectedRoute allowedRoles={STOCK_MUTATOR_ROLES} />,
      children: [
        { path: "/milkrun", element: <Navigate to="/admin/milkrun" replace /> },
        { path: "/teamlead", element: <Navigate to="/admin/dashboard" replace /> },
      ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ];

  return useRoutes(routes);
};
