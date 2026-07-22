/* eslint-disable react-refresh/only-export-components */
import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import {
  MASTER_DATA_MANAGER_ROLES,
  PACKING_ROLE,
  STOCK_MUTATOR_ROLES,
  STOCK_VIEWER_ROLES,
  USER_MANAGEMENT_ROLES,
} from "../constants/roles";

const AdminLayout = lazy(() =>
  import("../layouts/admin/AdminLayout").then((module) => ({
    default: module.AdminLayout,
  })),
);
const DashboardPage = lazy(() => import("../pages/admin/dashboard/DashboardPage"));
const UsersPage = lazy(() => import("../pages/admin/users/UsersPage"));
const RolesPage = lazy(() => import("../pages/admin/roles/RolesPage"));
const PositionsPage = lazy(() => import("../pages/admin/positions/PositionsPage"));
const AreasPage = lazy(() => import("../pages/admin/areas/AreasPage"));
const SuppliesPage = lazy(() => import("../pages/admin/supplies/SuppliesPage"));
const SupplyCategoriesPage = lazy(() =>
  import("../pages/admin/supply-categories/SupplyCategoriesPage"),
);
const UnitsPage = lazy(() => import("../pages/admin/units/UnitsPage"));
const StorageLocationsPage = lazy(() =>
  import("../pages/admin/storage-locations/StorageLocationsPage"),
);
const StockBalancesPage = lazy(() =>
  import("../pages/admin/stock-balances/StockBalancesPage"),
);
const StockTransactionsPage = lazy(() =>
  import("../pages/admin/stock-transactions/StockTransactionsPage"),
);
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
      element: <ProtectedRoute allowedRoles={STOCK_VIEWER_ROLES} />,
      children: [
        { path: "stock-balances", element: <StockBalancesPage /> },
        { path: "stock-transactions", element: <StockTransactionsPage /> },
        { path: "storage-locations", element: <StorageLocationsPage /> },
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={MASTER_DATA_MANAGER_ROLES} />,
      children: [
        { path: "supply-categories", element: <SupplyCategoriesPage /> },
        { path: "units", element: <UnitsPage /> },
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={STOCK_MUTATOR_ROLES} />,
      children: [
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
      ],
    },
    {
      element: <ProtectedRoute allowedRoles={STOCK_MUTATOR_ROLES} />,
      children: [{ path: "milkrun", element: <MilkrunPage /> }],
    },
    {
      element: <ProtectedRoute allowedRoles={USER_MANAGEMENT_ROLES} />,
      children: [
        { path: "users", element: <UsersPage /> },
        { path: "roles", element: <RolesPage /> },
        { path: "positions", element: <PositionsPage /> },
        { path: "areas", element: <AreasPage /> },
      ],
    },
  ],
};
