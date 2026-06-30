import React from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse, faChartSimple, faUsers, faTruck, faRoute, faBars, 
  faEllipsis, faChevronUp, faGear, faRightFromBracket, faXmark,
  faDashboard
} from "@fortawesome/free-solid-svg-icons";

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



const overviewLinks = [
  { to: "/admin", label: "Home", icon: faHouse },
  { to: "/admin/dashboard", label: "Dashboard", icon: faDashboard },
  { to: "/admin/analytics", label: "Analytics", icon: faChartSimple },
];

const managementLinks = [
  { to: "/admin/users", label: "Users", icon: faUsers },
  { to: "/admin/supplies", label: "Supplies", icon: faTruck },
  { to: "/admin/milkrun", label: "Milkrun", icon: faRoute },
];

const Sidebar = ({
  isSidebarCollapsed, setIsSidebarCollapsed,
  isMobileSidebarOpen, setIsMobileSidebarOpen,
  pathname, isProfileDropdownOpen, setIsProfileDropdownOpen, profileRef,
}: SidebarProps) => {

  const checkActive = (to: string) => pathname === to || (to === "/admin/dashboard" && pathname === "/admin/");

  const handleSidebarBackgroundClick = () => {
    if (isSidebarCollapsed) setIsSidebarCollapsed(false);
  };

  return (
    <aside
      id="sidebar"
      onClick={handleSidebarBackgroundClick}
      className={`z-50 flex shrink-0 flex-col justify-between bg-white transition-all duration-300 ease-in-out border-r border-slate-100 shadow-2xl
        /* Layout Mobile: Absolute & Trượt ra/vào */
        fixed inset-y-0 left-0 h-full rounded-r-3xl
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        
        /* Layout Desktop: Tương đối & Bo góc */
        md:relative md:translate-x-0 md:m-4 md:rounded-3xl md:h-[calc(100vh-32px)]
        
        /* Kích thước */
        ${isSidebarCollapsed ? "md:w-20 sidebar-collapsed cursor-pointer" : "w-64"}
      `}
    >
      <div className="p-6">
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between mb-8 px-2">
          <Link to="/admin/dashboard" className="flex items-center">
            <img className="w-9" src="https://upload.wikimedia.org/wikipedia/commons/4/43/VinFast_logo_%28simple_variant%29.svg" alt="Logo" />
          </Link>

          <div className="flex gap-2">
            {/* Nút đóng Sidebar chỉ hiện trên Mobile */}
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xl" />
            </button>

            {/* Nút thu gọn chỉ hiện trên Desktop */}
            {!isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden md:block rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <FontAwesomeIcon icon={faBars} className="text-xl" />
              </button>
            )}
          </div>
        </div>

        {/* Mảng Links */}
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            {!isSidebarCollapsed ? (
              <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Overview</p>
            ) : (
              <div className="flex justify-center text-slate-300 mb-2"><FontAwesomeIcon icon={faEllipsis} /></div>
            )}
            {overviewLinks.map((link) => (
              <Link
                key={link.to} to={link.to}
                className={`w-full sidebar-link ${checkActive(link.to) ? "active" : ""}`}
                title={isSidebarCollapsed ? link.label : undefined}
              >
                <FontAwesomeIcon icon={link.icon} className="text-lg w-5 shrink-0" />
                <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">{link.label}</span>
              </Link>
            ))}
          </div>

          <div className="space-y-1.5">
            {!isSidebarCollapsed ? (
              <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Management</p>
            ) : (
              <div className="flex justify-center text-slate-300 mb-2"><FontAwesomeIcon icon={faEllipsis} /></div>
            )}
            {managementLinks.map((link) => (
              <Link
                key={link.to} to={link.to}
                className={`w-full sidebar-link ${checkActive(link.to) ? "active" : ""}`}
                title={isSidebarCollapsed ? link.label : undefined}
              >
                <FontAwesomeIcon icon={link.icon} className="text-lg w-5 shrink-0" />
                <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm flex items-center w-full">
                  {link.label}
                  {link.badge && <span className="new-badge ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">{link.badge}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Sidebar / Profile Dropdown */}
      <div className="mt-auto p-4 border-t border-slate-50">
        <div className="relative" ref={profileRef}>
          <div
            onClick={(e) => { e.stopPropagation(); setIsProfileDropdownOpen(!isProfileDropdownOpen); }}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-2 transition-all hover:border-slate-100 hover:bg-slate-50"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png" alt="Profile" className="h-10 w-10 shrink-0 rounded-full shadow border-slate-200" />
            {!isSidebarCollapsed && (
              <>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="text-sm font-bold text-slate-700 truncate">Đinh Xuân Trường</span>
                  <span className="text-[11px] text-slate-400">Tổ trưởng dữ liệu</span>
                </div>
                <FontAwesomeIcon icon={faChevronUp} className="text-slate-400 shrink-0" />
              </>
            )}
          </div>

          {isProfileDropdownOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600">
                <FontAwesomeIcon icon={faGear} /> <span className="sidebar-text">Settings</span>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-600">
                <FontAwesomeIcon icon={faRightFromBracket} /> <span className="sidebar-text">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;