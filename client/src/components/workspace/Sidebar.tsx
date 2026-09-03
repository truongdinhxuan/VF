import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faEllipsis,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { AppTooltip } from "../common/AppTooltip";
import { IconButton } from "../common/Button";
import { buildWorkspaceNavigation } from "../../constants/workspaceNavigation";
import {
  getRoleHomePath,
  getWorkspacePath,
} from "../../constants/workspaces";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  pathname: string;
}

const Sidebar = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  pathname,
}: SidebarProps) => {
  const {
    user, role, hasPermission, hasAnyPermission, hasAllPermissions,
  } = useAuth();
  const navigation = buildWorkspaceNavigation(
    role,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  );
  const homePath = getRoleHomePath(role);
  const ordersPath = getWorkspacePath(role, "orders");
  const createOrderPath = getWorkspacePath(role, "orders/create");
  const milkrunTripsPath = getWorkspacePath(role, "milkrun/trips");
  const createMilkrunTripPath = getWorkspacePath(role, "milkrun/trips/create");
  const myMilkrunTripsPath = getWorkspacePath(role, "milkrun/trips/my");
  const profile = user?.publicData;
  const displayName = [profile?.last_name, profile?.first_name]
    .filter(Boolean)
    .join(" ") || profile?.email || "Người dùng";
  const roleDisplayName =
    profile?.role && typeof profile.role === "object"
      ? profile.role.name
      : role ?? "Guest";

  const checkActive = (to: string) => {
    if (to === ordersPath) {
      return pathname === to || (pathname.startsWith(`${to}/`) && pathname !== createOrderPath);
    }
    if (to === milkrunTripsPath) {
      return pathname === to || (
        pathname.startsWith(`${to}/`)
        && pathname !== createMilkrunTripPath
        && pathname !== myMilkrunTripsPath
      );
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <aside
      id="sidebar"
      className={`workspace-sidebar fixed inset-y-0 left-0 z-40 flex h-screen h-dvh w-72 max-w-[calc(100vw-1rem)] shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white shadow-2xl md:relative md:inset-y-auto md:m-3 md:h-auto md:max-w-none md:self-stretch md:translate-x-0 md:rounded-3xl lg:m-4
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        ${isSidebarCollapsed ? "md:w-[4.5rem]" : "md:w-64"}`}
      data-mobile-open={isMobileSidebarOpen}
    >
      <div className={`w-full shrink-0 pb-4 pt-5 ${isSidebarCollapsed ? "px-3 md:px-2" : "px-5"}`}>
        <div className={`flex items-center justify-between gap-2 ${isSidebarCollapsed ? "md:flex-col" : ""}`}>
          <Link
            to={homePath}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="flex shrink-0 items-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Về trang tổng quan"
          >
            <img
              className="w-9"
              src="https://upload.wikimedia.org/wikipedia/commons/4/43/VinFast_logo_%28simple_variant%29.svg"
              alt="VinFast"
            />
          </Link>
          <div className="flex shrink-0 gap-1">
            <AppTooltip content="Đóng menu" side="bottom">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`${IconButton} md:hidden`}
                aria-label="Đóng menu"
                aria-controls="sidebar"
              >
                <FontAwesomeIcon icon={faXmark} className="text-xl" aria-hidden="true" />
              </button>
            </AppTooltip>
            <AppTooltip content={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"} side="right">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`${IconButton} !hidden md:!inline-flex`}
                aria-label={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
                aria-expanded={!isSidebarCollapsed}
              >
                <FontAwesomeIcon icon={faBars} className="text-xl" aria-hidden="true" />
              </button>
            </AppTooltip>
          </div>
        </div>
      </div>

      <nav
        className={`flex min-h-0 w-full flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto overscroll-contain pb-6 [scrollbar-gutter:stable] ${isSidebarCollapsed ? "px-4 md:px-2" : "px-5"}`}
        aria-label="Điều hướng workspace"
      >
        {navigation.map((catalog) => (
          <div key={catalog.label} className="space-y-3">
            <p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${isSidebarCollapsed ? "md:hidden" : ""}`}>
              {catalog.label}
            </p>
            {isSidebarCollapsed && (
              <div className="mb-2 hidden justify-center text-slate-300 md:flex">
                <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
              </div>
            )}
            {catalog.groups.map((group) => (
              <div key={`${catalog.label}-${group.label}`} className="space-y-1.5">
                <p className={`px-3 pt-1 text-[10px] font-semibold text-slate-400 ${isSidebarCollapsed ? "md:hidden" : ""}`}>
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <AppTooltip
                    key={`${catalog.label}-${group.label}-${item.label}`}
                    content={item.label}
                    side="right"
                    disabled={!isSidebarCollapsed || isMobileSidebarOpen}
                  >
                    <Link
                      to={item.to}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSidebarCollapsed ? "md:mx-auto md:h-11 md:w-11 md:justify-center md:px-0" : ""} ${checkActive(item.to) ? "bg-blue-50 font-semibold text-blue-700" : ""}`}
                      aria-label={isSidebarCollapsed ? item.label : undefined}
                      aria-current={checkActive(item.to) ? "page" : undefined}
                    >
                      <FontAwesomeIcon icon={item.icon} className="w-5 shrink-0 text-lg" aria-hidden="true" />
                      <span className={`min-w-0 flex-1 truncate ${isSidebarCollapsed ? "md:hidden" : ""}`}>
                        {item.label}
                      </span>
                    </Link>
                  </AppTooltip>
                ))}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className={`w-full shrink-0 border-t border-slate-100 bg-white ${isSidebarCollapsed ? "p-3 md:px-2" : "p-4"}`}>
        <AppTooltip
          content={`${displayName} — ${roleDisplayName}`}
          side="right"
          disabled={!isSidebarCollapsed || isMobileSidebarOpen}
        >
          <div className={`flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-2 ${isSidebarCollapsed ? "md:justify-center" : ""}`}>
              <img
                src={profile?.avatar_url || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                alt=""
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-full border-slate-200 object-cover shadow"
              />
            <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? "md:hidden" : ""}`}>
              <p className="truncate text-sm font-bold text-slate-700">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500">{roleDisplayName}</p>
            </div>
          </div>
        </AppTooltip>
      </div>
    </aside>
  );
};

export default Sidebar;
