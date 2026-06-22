import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

// Chỉ tải Layout và Page khi người dùng thực sự truy cập vào phân hệ /admin
const AdminLayout = lazy(() => 
  import("../layouts/admin/AdminLayout").then(m => ({ default: m.AdminLayout }))
);
const AdminHomePage = lazy(() => import("../pages/admin/AdminHomePage"));
const UserHomePage = lazy(() => import("../pages/admin/users/UserHomePage"));

export const adminRoutes: RouteObject = {
  path: "admin",
  element: <AdminLayout />,
  children: [
    { index: true, element: <AdminHomePage /> },
    { path: "users", element: <UserHomePage /> }
  ]
};