import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxesStacked,
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
} from "@fortawesome/free-solid-svg-icons";
import type { RoleCode } from "./roles";
import {
  MASTER_DATA_VIEWER_ROLES,
  ORDER_CREATOR_ROLES,
  STOCK_MUTATOR_ROLES,
  STOCK_VIEWER_ROLES,
  USER_VIEWER_ROLES,
} from "./roles";

export interface AdminNavigationItem {
  to: string;
  label: string;
  icon: IconDefinition;
  roles?: readonly RoleCode[];
}

export interface AdminNavigationGroup {
  label: string;
  items: readonly AdminNavigationItem[];
}

export const ADMIN_NAVIGATION: readonly AdminNavigationGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: faDashboard }],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/orders", label: "Orders", icon: faClipboardList },
      {
        to: "/admin/orders/create",
        label: "Create order",
        icon: faPlus,
        roles: ORDER_CREATOR_ROLES,
      },
      {
        to: "/admin/stock-balances",
        label: "Stock balances",
        icon: faWarehouse,
        roles: STOCK_VIEWER_ROLES,
      },
      {
        to: "/admin/stock-transactions",
        label: "Stock transactions",
        icon: faClockRotateLeft,
        roles: STOCK_VIEWER_ROLES,
      },
      {
        to: "/admin/stock-adjustments",
        label: "Stock adjustments",
        icon: faSliders,
        roles: STOCK_MUTATOR_ROLES,
      },
      {
        to: "/admin/stock-transfers",
        label: "Stock transfers",
        icon: faRightLeft,
        roles: STOCK_MUTATOR_ROLES,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/admin/supplies", label: "Supplies", icon: faTruck },
      {
        to: "/admin/supply-categories",
        label: "Supply categories",
        icon: faLayerGroup,
        roles: MASTER_DATA_VIEWER_ROLES,
      },
      {
        to: "/admin/units",
        label: "Units",
        icon: faRulerCombined,
        roles: MASTER_DATA_VIEWER_ROLES,
      },
      {
        to: "/admin/storage-locations",
        label: "Storage locations",
        icon: faLocationDot,
        roles: STOCK_VIEWER_ROLES,
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        to: "/admin/users",
        label: "Users",
        icon: faUsers,
        roles: USER_VIEWER_ROLES,
      },
      {
        to: "/admin/roles",
        label: "Roles",
        icon: faUserShield,
        roles: USER_VIEWER_ROLES,
      },
      {
        to: "/admin/areas",
        label: "Areas",
        icon: faWarehouse,
        roles: USER_VIEWER_ROLES,
      },
      {
        to: "/admin/milkrun",
        label: "Milkrun (legacy)",
        icon: faBoxesStacked,
        roles: STOCK_MUTATOR_ROLES,
      },
    ],
  },
];

export const navigationForRole = (role: RoleCode | null): AdminNavigationGroup[] =>
  ADMIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (role !== null && item.roles.includes(role)),
    ),
  })).filter((group) => group.items.length > 0);
