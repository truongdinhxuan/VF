/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import {
  AREA_VIEWER_ROLES,
  MASTER_DATA_VIEWER_ROLES,
  ORDER_CREATOR_ROLES,
  PROVIDER_VIEWER_ROLES,
  ROLE_CODES,
  STOCK_MUTATOR_ROLES,
  STOCK_VIEWER_ROLES,
  USER_VIEWER_ROLES,
  type RoleCode,
} from '../constants/roles';
import { ROLE_WORKSPACES } from '../constants/workspaces';

const WorkspaceLayout = lazy(() =>
  import('../layouts/workspace/WorkspaceLayout').then((module) => ({
    default: module.WorkspaceLayout,
  })),
);
const RoleDashboardPage = lazy(() =>
  import('../pages/dashboards/RoleDashboardPage'),
);
const UsersPage = lazy(() => import('../pages/management/UsersPage'));
const RolesPage = lazy(() => import('../pages/management/RolesPage'));
const AreasPage = lazy(() => import('../pages/management/AreasPage'));
const SuppliesPage = lazy(() => import('../pages/catalog/SuppliesPage'));
const ProvidersPage = lazy(() => import('../pages/catalog/ProvidersPage'));
const SupplyCategoriesPage = lazy(() =>
  import('../pages/catalog/SupplyCategoriesPage'),
);
const UnitsPage = lazy(() => import('../pages/catalog/UnitsPage'));
const StorageLocationsPage = lazy(() =>
  import('../pages/catalog/StorageLocationsPage'),
);
const StockBalancesPage = lazy(() =>
  import('../pages/stock/StockBalancesPage'),
);
const StockTransactionsPage = lazy(() =>
  import('../pages/stock/StockTransactionsPage'),
);
const MilkrunPage = lazy(() => import('../pages/operations/MilkrunPage'));
const WorkspacePlaceholderPage = lazy(() =>
  import('../pages/operations/WorkspacePlaceholderPage'),
);
const OrdersListPage = lazy(() => import('../pages/orders/OrdersListPage'));
const CreateOrderPage = lazy(() => import('../pages/orders/CreateOrderPage'));
const OrderDetailPage = lazy(() => import('../pages/orders/OrderDetailPage'));

const hasRole = (
  roles: readonly RoleCode[],
  role: RoleCode,
): boolean => roles.includes(role);

const createFeatureRoutes = (role: RoleCode): RouteObject[] => {
  const routes: RouteObject[] = [
    { index: true, element: <Navigate to="dashboard" replace /> },
    {
      path: 'dashboard',
      element: <RoleDashboardPage workspaceRole={role} />,
    },
    { path: 'supplies', element: <SuppliesPage /> },
    { path: 'orders', element: <OrdersListPage /> },
    { path: 'orders/:id', element: <OrderDetailPage /> },
  ];

  if (hasRole(ORDER_CREATOR_ROLES, role)) {
    routes.push({ path: 'orders/create', element: <CreateOrderPage /> });
  }

  if (hasRole(STOCK_VIEWER_ROLES, role)) {
    routes.push(
      { path: 'stock-balances', element: <StockBalancesPage /> },
      { path: 'stock-transactions', element: <StockTransactionsPage /> },
      { path: 'storage-locations', element: <StorageLocationsPage /> },
    );
  }

  if (hasRole(MASTER_DATA_VIEWER_ROLES, role)) {
    routes.push(
      { path: 'supply-categories', element: <SupplyCategoriesPage /> },
      { path: 'units', element: <UnitsPage /> },
    );
  }

  if (hasRole(PROVIDER_VIEWER_ROLES, role)) {
    routes.push({ path: 'providers', element: <ProvidersPage /> });
  }

  if (hasRole(STOCK_MUTATOR_ROLES, role)) {
    routes.push(
      {
        path: 'stock-adjustments',
        element: (
          <WorkspacePlaceholderPage
            title="Stock adjustments"
            description="Điều chỉnh tồn ngoài order và bắt buộc nhập lý do."
          />
        ),
      },
      {
        path: 'stock-transfers',
        element: (
          <WorkspacePlaceholderPage
            title="Stock transfers"
            description="Chuyển vật tư giữa các vị trí với transaction OUT/IN."
          />
        ),
      },
      { path: 'milkrun', element: <MilkrunPage /> },
    );
  }

  if (hasRole(USER_VIEWER_ROLES, role)) {
    routes.push(
      { path: 'users', element: <UsersPage /> },
      { path: 'roles', element: <RolesPage /> },
    );
  }

  if (hasRole(AREA_VIEWER_ROLES, role)) {
    routes.push({ path: 'areas', element: <AreasPage /> });
  }

  routes.push({ path: '*', element: <Navigate to="dashboard" replace /> });
  return routes;
};

const createWorkspaceRoute = (role: RoleCode): RouteObject => ({
  element: (
    <ProtectedRoute
      allowedRoles={[role]}
      redirectRoleMismatchToHome
    />
  ),
  children: [
    {
      path: ROLE_WORKSPACES[role].basePath.slice(1),
      element: <WorkspaceLayout />,
      children: createFeatureRoutes(role),
    },
  ],
});

export const workspaceRoutes: RouteObject[] = ROLE_CODES.map(
  createWorkspaceRoute,
);
