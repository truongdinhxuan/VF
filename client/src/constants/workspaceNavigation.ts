import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxesStacked,
  faBuilding,
  faClipboardList,
  faClockRotateLeft,
  faDashboard,
  faLayerGroup,
  faLocationDot,
  faPlus,
  faRightLeft,
  faRulerCombined,
  faSliders,
  faTruck,
  faUserShield,
  faUsers,
  faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import type { RoleCode } from './roles';
import {
  AREA_VIEWER_ROLES,
  MASTER_DATA_VIEWER_ROLES,
  ORDER_CREATOR_ROLES,
  PROVIDER_VIEWER_ROLES,
  STOCK_MUTATOR_ROLES,
  STOCK_VIEWER_ROLES,
  USER_VIEWER_ROLES,
} from './roles';
import { getWorkspacePath } from './workspaces';

interface WorkspaceNavigationDefinition {
  path: string;
  label: string;
  icon: IconDefinition;
  roles?: readonly RoleCode[];
}

interface WorkspaceNavigationGroupDefinition {
  label: string;
  items: readonly WorkspaceNavigationDefinition[];
}

export interface WorkspaceNavigationItem extends WorkspaceNavigationDefinition {
  to: string;
}

export interface WorkspaceNavigationGroup {
  label: string;
  items: readonly WorkspaceNavigationItem[];
}

const WORKSPACE_NAVIGATION: readonly WorkspaceNavigationGroupDefinition[] = [
  {
    label: 'Overview',
    items: [{ path: 'dashboard', label: 'Dashboard', icon: faDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { path: 'orders', label: 'Orders', icon: faClipboardList },
      {
        path: 'orders/create',
        label: 'Create order',
        icon: faPlus,
        roles: ORDER_CREATOR_ROLES,
      },
      {
        path: 'stock-balances',
        label: 'Stock balances',
        icon: faWarehouse,
        roles: STOCK_VIEWER_ROLES,
      },
      {
        path: 'stock-transactions',
        label: 'Stock transactions',
        icon: faClockRotateLeft,
        roles: STOCK_VIEWER_ROLES,
      },
      {
        path: 'stock-adjustments',
        label: 'Stock adjustments',
        icon: faSliders,
        roles: STOCK_MUTATOR_ROLES,
      },
      {
        path: 'stock-transfers',
        label: 'Stock transfers',
        icon: faRightLeft,
        roles: STOCK_MUTATOR_ROLES,
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { path: 'supplies', label: 'Supplies', icon: faTruck },
      {
        path: 'providers',
        label: 'Providers',
        icon: faBuilding,
        roles: PROVIDER_VIEWER_ROLES,
      },
      {
        path: 'supply-categories',
        label: 'Supply categories',
        icon: faLayerGroup,
        roles: MASTER_DATA_VIEWER_ROLES,
      },
      {
        path: 'units',
        label: 'Units',
        icon: faRulerCombined,
        roles: MASTER_DATA_VIEWER_ROLES,
      },
      {
        path: 'storage-locations',
        label: 'Storage locations',
        icon: faLocationDot,
        roles: STOCK_VIEWER_ROLES,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        path: 'users',
        label: 'Users',
        icon: faUsers,
        roles: USER_VIEWER_ROLES,
      },
      {
        path: 'roles',
        label: 'Roles',
        icon: faUserShield,
        roles: USER_VIEWER_ROLES,
      },
      {
        path: 'areas',
        label: 'Areas',
        icon: faWarehouse,
        roles: AREA_VIEWER_ROLES,
      },
      {
        path: 'milkrun',
        label: 'Milkrun (legacy)',
        icon: faBoxesStacked,
        roles: STOCK_MUTATOR_ROLES,
      },
    ],
  },
];

export const navigationForRole = (
  role: RoleCode | null,
): WorkspaceNavigationGroup[] =>
  WORKSPACE_NAVIGATION.map((group) => ({
    label: group.label,
    items: group.items
      .filter(
        (item) => !item.roles || (role !== null && item.roles.includes(role)),
      )
      .map((item) => ({
        ...item,
        to: getWorkspacePath(role, item.path),
      })),
  })).filter((group) => group.items.length > 0);
