import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChevronUp,
  faEllipsis,
  faGear,
  faRightFromBracket,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";
import { AppTooltip } from "../common/AppTooltip";
import { getButtonClassName, IconButton } from "../common/Button";
import { navigationForRole } from "../../constants/workspaceNavigation";
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
  isProfileDropdownOpen: boolean;
  setIsProfileDropdownOpen: (open: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement | null>;
}

const Sidebar = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  pathname,
  isProfileDropdownOpen,
  setIsProfileDropdownOpen,
  profileRef,
}: SidebarProps) => {
  const navigate = useNavigate();
  const { user, role, logoutContext } = useAuth();
  const navigation = navigationForRole(role);
  const homePath = getRoleHomePath(role);
  const ordersPath = getWorkspacePath(role, "orders");
  const createOrderPath = getWorkspacePath(role, "orders/create");
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
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const handleLogout = () => {
    logoutContext();
    navigate("/auth/login", { replace: true });
  };

  return (
    <aside
      id="sidebar"
      onClick={() => isSidebarCollapsed && setIsSidebarCollapsed(false)}
      className={`z-50 flex h-screen h-dvh max-w-[calc(100vw-1rem)] shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white shadow-2xl transition-all duration-300 ease-in-out
        fixed inset-y-0 left-0 rounded-r-3xl
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:inset-y-auto md:m-4 md:h-auto md:max-w-none md:self-stretch md:translate-x-0 md:rounded-3xl
        ${isSidebarCollapsed ? "sidebar-collapsed cursor-pointer md:w-20" : "w-64"}`}
    >
      <div className="w-full shrink-0 px-6 pb-4 pt-6">
        <div
          onClick={(event) => event.stopPropagation()}
          className="flex items-center justify-between px-2"
        >
          <Link to={homePath} className="flex items-center">
            <img
              className="w-9"
              src="https://upload.wikimedia.org/wikipedia/commons/4/43/VinFast_logo_%28simple_variant%29.svg"
              alt="VinFast"
            />
          </Link>
          <div className="flex gap-2">
            <AppTooltip content="Đóng menu" side="bottom">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`${IconButton} md:hidden`}
                aria-label="Đóng menu"
              >
                <FontAwesomeIcon icon={faXmark} className="text-xl" aria-hidden="true" />
              </button>
            </AppTooltip>
            {!isSidebarCollapsed && (
              <AppTooltip content="Thu gọn menu" side="bottom">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(true)}
                  className={`${IconButton} hidden md:inline-flex`}
                  aria-label="Thu gọn menu"
                >
                  <FontAwesomeIcon icon={faBars} className="text-xl" aria-hidden="true" />
                </button>
              </AppTooltip>
            )}
          </div>
        </div>
      </div>

      <nav
        className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto overscroll-contain px-6 pb-6 [scrollbar-gutter:stable]"
        aria-label="Admin navigation"
      >
        {navigation.map((group) => (
          <div key={group.label} className="space-y-1.5">
            {!isSidebarCollapsed ? (
              <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
            ) : (
              <div className="mb-2 flex justify-center text-slate-300">
                <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
              </div>
            )}
            {group.items.map((item) => (
              <AppTooltip
                key={item.to}
                content={item.label}
                side="right"
                disabled={!isSidebarCollapsed}
              >
                <Link
                  to={item.to}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`sidebar-link w-full ${checkActive(item.to) ? "active" : ""}`}
                  aria-label={isSidebarCollapsed ? item.label : undefined}
                >
                  <FontAwesomeIcon icon={item.icon} className="w-5 shrink-0 text-lg" aria-hidden="true" />
                  <span className="sidebar-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-sm">
                    {item.label}
                  </span>
                </Link>
              </AppTooltip>
            ))}
          </div>
        ))}
      </nav>

      <div className="w-full shrink-0 border-t border-slate-100 bg-white p-4">
        <div className="relative" ref={profileRef}>
          <AppTooltip
            content={`${displayName} — ${roleDisplayName}`}
            side="right"
            disabled={!isSidebarCollapsed}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsProfileDropdownOpen(!isProfileDropdownOpen);
              }}
              className={getButtonClassName({
                variant: "ghost",
                size: "sm",
                block: true,
                className: "!justify-start rounded-xl text-left",
              })}
              aria-label={isSidebarCollapsed ? `Mở menu tài khoản của ${displayName}` : undefined}
              aria-expanded={isProfileDropdownOpen}
              aria-haspopup="menu"
            >
              <img
                src={profile?.avatar_url || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                alt=""
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-full border-slate-200 object-cover shadow"
              />
              {!isSidebarCollapsed && (
                <>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate text-sm font-bold text-slate-700">{displayName}</span>
                    <span className="truncate text-[11px] text-slate-400">
                      {roleDisplayName}
                    </span>
                  </div>
                  <FontAwesomeIcon icon={faChevronUp} className="shrink-0 text-slate-400" aria-hidden="true" />
                </>
              )}
            </button>
          </AppTooltip>

          {isProfileDropdownOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
              <AppTooltip
                content="Cài đặt"
                side="right"
                disabled={!isSidebarCollapsed}
              >
                <button
                  type="button"
                  className={getButtonClassName({
                    variant: "ghost",
                    size: "sm",
                    block: true,
                    className: "!justify-start",
                  })}
                  aria-label={isSidebarCollapsed ? "Cài đặt" : undefined}
                >
                  <FontAwesomeIcon icon={faGear} aria-hidden="true" />
                  <span className="sidebar-text">Settings</span>
                </button>
              </AppTooltip>
              <AppTooltip
                content="Đăng xuất"
                side="right"
                disabled={!isSidebarCollapsed}
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  className={getButtonClassName({
                    variant: "textError",
                    size: "sm",
                    block: true,
                    className: "!justify-start",
                  })}
                  aria-label={isSidebarCollapsed ? "Đăng xuất" : undefined}
                >
                  <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
                  <span className="sidebar-text">Logout</span>
                </button>
              </AppTooltip>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
