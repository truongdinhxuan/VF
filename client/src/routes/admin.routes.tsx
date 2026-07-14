/* eslint-disable react-refresh/only-export-components */
import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import {
  MATERIAL_ROLES,
  PACKING_ROLE,
  USER_MANAGEMENT_ROLES,
} from "../constants/roles";

const AdminLayout = lazy(() =>
  import("../layouts/admin/AdminLayout").then((module) => ({
    default: module.AdminLayout,
  })),
);
const DashboardPage = lazy(() => import("../pages/admin/dashboard/DashboardPage"));
const UsersPage = lazy(() => import("../pages/admin/users/UsersPage"));
const SuppliesPage = lazy(() => import("../pages/admin/supplies/SuppliesPage"));
const MilkrunPage = lazy(() => import("../pages/admin/milkrun/MilkrunPage"));
const AdminPlaceholderPage = lazy(() => import("../pages/admin/AdminPlaceholderPage"));
const OrdersListPage = lazy(() => import("../pages/admin/orders/OrdersListPage"));
const CreateOrderPage = lazy(() => import("../pages/admin/orders/CreateOrderPage"));
const OrderDetailPage = lazy(() => import("../pages/admin/orders/OrderDetailPage"));

export const adminRoutes: RouteObject = {
  path: "admin",
  element: <AdminLayout />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    { path: "dashboard", element: <DashboardPage /> },
    { path: "supplies", element: <SuppliesPage /> },
    { path: "orders", element: <OrdersListPage /> },
    { path: "orders/:id", element: <OrderDetailPage /> },
    {
      element: <ProtectedRoute allowedRoles={[PACKING_ROLE]} />,
      children: [
        {
          path: "orders/create",
          element: <CreateOrderPage />,
        },
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={MATERIAL_ROLES} />,
      children: [
        {
          path: "stock-balances",
          element: (
            <AdminPlaceholderPage
              title="Stock balances"
              description="Tồn kho hiện tại theo vật tư, khu vực và vị trí lưu."
            />
          ),
        },
        {
          path: "stock-transactions",
          element: (
            <AdminPlaceholderPage
              title="Stock transactions"
              description="Audit log biến động kho; không sửa hoặc xóa giao dịch cũ."
            />
          ),
        },
        {
          path: "stock-adjustments",
          element: (
            <AdminPlaceholderPage
              title="Stock adjustments"
              description="Điều chỉnh tồn ngoài order và bắt buộc nhập lý do."
            />
          ),
        },
        {
          path: "stock-transfers",
          element: (
            <AdminPlaceholderPage
              title="Stock transfers"
              description="Chuyển vật tư giữa các vị trí với transaction OUT/IN."
            />
          ),
        },
        { path: "milkrun", element: <MilkrunPage /> },
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={USER_MANAGEMENT_ROLES} />,
      children: [
        { path: "users", element: <UsersPage /> },
        {
          path: "roles",
          element: (
            <AdminPlaceholderPage
              title="Roles"
              description="Hệ thống chỉ sử dụng bốn role đã định nghĩa trong Application.xlsx."
            />
          ),
        },
      ],
    },
  ],
};
