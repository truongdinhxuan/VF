import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxesStacked,
  faClipboardList,
  faClockRotateLeft,
  faDashboard,
  faPlus,
  faRightLeft,
  faSliders,
  faTruck,
  faUserShield,
  faUsers,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import type { RoleName } from "./roles";
import { MATERIAL_ROLES, PACKING_ROLE, USER_MANAGEMENT_ROLES } from "./roles";

export interface AdminNavigationItem {
  to: string;
  label: string;
  icon: IconDefinition;
  roles?: readonly RoleName[];
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
      { to: "/admin/supplies", label: "Supplies", icon: faTruck },
      { to: "/admin/orders", label: "Orders", icon: faClipboardList },
      {
        to: "/admin/orders/create",
        label: "Create order",
        icon: faPlus,
        roles: [PACKING_ROLE],
      },
      {
        to: "/admin/stock-balances",
        label: "Stock balances",
        icon: faWarehouse,
        roles: MATERIAL_ROLES,
      },
      {
        to: "/admin/stock-transactions",
        label: "Stock transactions",
        icon: faClockRotateLeft,
        roles: MATERIAL_ROLES,
      },
      {
        to: "/admin/stock-adjustments",
        label: "Stock adjustments",
        icon: faSliders,
        roles: MATERIAL_ROLES,
      },
      {
        to: "/admin/stock-transfers",
        label: "Stock transfers",
        icon: faRightLeft,
        roles: MATERIAL_ROLES,
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
        roles: USER_MANAGEMENT_ROLES,
      },
      {
        to: "/admin/roles",
        label: "Roles",
        icon: faUserShield,
        roles: USER_MANAGEMENT_ROLES,
      },
      {
        to: "/admin/milkrun",
        label: "Milkrun (legacy)",
        icon: faBoxesStacked,
        roles: MATERIAL_ROLES,
      },
    ],
  },
];

export const navigationForRole = (role: RoleName | null): AdminNavigationGroup[] =>
  ADMIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (role !== null && item.roles.includes(role)),
    ),
  })).filter((group) => group.items.length > 0);
