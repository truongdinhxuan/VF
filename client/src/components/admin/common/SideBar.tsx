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
import { navigationForRole } from "../../../constants/adminNavigation";
import { useAuth } from "../../../context/AuthContext";

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
  const profile = user?.publicData;
  const displayName = [profile?.last_name, profile?.first_name]
    .filter(Boolean)
    .join(" ") || profile?.email || "Người dùng";

  const checkActive = (to: string) => {
    if (to === "/admin/orders") {
      return pathname === to || (pathname.startsWith(`${to}/`) && pathname !== "/admin/orders/create");
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
      className={`z-50 flex shrink-0 flex-col justify-between border-r border-slate-100 bg-white shadow-2xl transition-all duration-300 ease-in-out
        fixed inset-y-0 left-0 h-full rounded-r-3xl
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:m-4 md:h-[calc(100vh-32px)] md:translate-x-0 md:rounded-3xl
        ${isSidebarCollapsed ? "sidebar-collapsed cursor-pointer md:w-20" : "w-64"}`}
    >
      <div className="p-6">
        <div
          onClick={(event) => event.stopPropagation()}
          className="mb-8 flex items-center justify-between px-2"
        >
          <Link to="/admin/dashboard" className="flex items-center">
            <img
              className="w-9"
              src="https://upload.wikimedia.org/wikipedia/commons/4/43/VinFast_logo_%28simple_variant%29.svg"
              alt="VinFast"
            />
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
              aria-label="Đóng menu"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xl" />
            </button>
            {!isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:block"
                aria-label="Thu gọn menu"
              >
                <FontAwesomeIcon icon={faBars} className="text-xl" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-6" aria-label="Admin navigation">
          {navigation.map((group) => (
            <div key={group.label} className="space-y-1.5">
              {!isSidebarCollapsed ? (
                <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
              ) : (
                <div className="mb-2 flex justify-center text-slate-300">
                  <FontAwesomeIcon icon={faEllipsis} />
                </div>
              )}
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`sidebar-link w-full ${checkActive(item.to) ? "active" : ""}`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <FontAwesomeIcon icon={item.icon} className="w-5 shrink-0 text-lg" />
                  <span className="sidebar-text overflow-hidden whitespace-nowrap text-sm">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-50 p-4">
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsProfileDropdownOpen(!isProfileDropdownOpen);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left hover:border-slate-100 hover:bg-slate-50"
          >
            <img
              src={profile?.avatar_url || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
              alt={displayName}
              className="h-10 w-10 shrink-0 rounded-full border-slate-200 object-cover shadow"
            />
            {!isSidebarCollapsed && (
              <>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-bold text-slate-700">{displayName}</span>
                  <span className="truncate text-[11px] text-slate-400">
                    {role ?? "Chưa gán role"}
                  </span>
                </div>
                <FontAwesomeIcon icon={faChevronUp} className="shrink-0 text-slate-400" />
              </>
            )}
          </button>

          {isProfileDropdownOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600"
              >
                <FontAwesomeIcon icon={faGear} />
                <span className="sidebar-text">Settings</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <FontAwesomeIcon icon={faRightFromBracket} />
                <span className="sidebar-text">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
