import { lazy } from "react";
import { type RouteObject, useRoutes, Navigate } from "react-router-dom";
import { adminRoutes } from "./admin.routes";
import { authRoutes } from "./auth.routes";
import { ProtectedRoute } from "../components/ProtectedRoute";

// Lazy load các trang độc lập khác
const HomePage = lazy(() => import("../pages/HomePage"));
const MilkrunHomepage = lazy(() => import("../pages/milkrun/MilkrunHomepage"));
const TeamLeadHomepage = lazy(() => 
  import("../pages/teamlead/TeamLeadHomePage").then(m => ({ default: m.TeamLeadHomepage }))
);

export const AppRoutes = () => {
  const routes: RouteObject[] = [
    // 1. Public Routes
    {
      path: "/",
      element: <HomePage />
    },
    authRoutes,

    // 2. Protected Routes dành cho Admin
    {
      element: <ProtectedRoute allowedRoles={["admin"]} />,
      children: [
        adminRoutes
      ]
    },

    // 3. Protected Routes dành cho Milkrun
    {
      element: <ProtectedRoute allowedRoles={["milkrun", "admin"]} />,
      children: [
        {
          path: "milkrun",
          element: <MilkrunHomepage />
        }
      ]
    },

    // 4. Protected Routes dành cho Teamlead
    {
      element: <ProtectedRoute allowedRoles={["teamlead", "admin"]} />,
      children: [
        {
          path: "teamlead",
          element: <TeamLeadHomepage />
        }
      ]
    },

    // 5. Catch-all: Tự động điều hướng về trang chủ nếu gõ sai đường dẫn
    {
      path: "*",
      element: <Navigate to="/" replace />
    }
  ];

  return useRoutes(routes);
};