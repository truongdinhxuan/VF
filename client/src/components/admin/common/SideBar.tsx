import React from "react";
import { Link } from "react-router-dom";

// Định nghĩa Props cho Component Sidebar
interface SidebarProps {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  pathname: string;
  isProfileDropdownOpen: boolean;
  setIsProfileDropdownOpen: (open: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement | null>;
}

const Sidebar = ({
  isSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  pathname,
  isProfileDropdownOpen,
  setIsProfileDropdownOpen,
  profileRef,
}: SidebarProps) => {
  return (
    <aside 
      id="sidebar" 
      className={`z-40 flex shrink-0 flex-col justify-between border-r border-slate-100 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-[#1e293b]
        ${isSidebarCollapsed ? "w-20 sidebar-collapsed" : "w-80"} 
        ${isMobileSidebarOpen ? "mobile-open" : ""}`}
    >
      <div className="p-6">
        {/* Vùng Logo */}
        <Link to="/admin" className="mb-10 flex cursor-pointer items-center gap-3 px-2">
          <img className="w-9" src='https://upload.wikimedia.org/wikipedia/commons/4/43/VinFast_logo_%28simple_variant%29.svg'/>
          <span className="sidebar-text text-2xl font-extrabold tracking-tight text-slate-800 dark:text-stone-100">
            Admin<span className="text-blue-600 dark:text-blue-500 font-bold">Page</span>
          </span>
        </Link>

        {/* Các liên kết điều hướng */}
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Overview
            </p>
            <div className="sidebar-divider hidden text-slate-400 dark:text-stone-500 mb-2">
              <i className="hgi-stroke hgi-more-horizontal text-md"></i>
            </div>
            <Link 
              to="/admin" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin" || pathname === "/admin/" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-home-01 text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">Dashboard</span>
            </Link>
            <Link 
              to="/admin/analytics" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin/analytics" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-analytics-01 text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">Analytics</span>
            </Link>
          </div>

          <div className="space-y-1.5">
            <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Pages
            </p>
            <div className="sidebar-divider hidden text-slate-400 dark:text-stone-500 mb-2">
              <i className="hgi-stroke hgi-more-horizontal text-md"></i>
            </div>
            <Link 
              to="/admin/ecommerce" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin/ecommerce" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-shopping-cart-01 text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm flex items-center w-full">
                E-Commerce
                <span className="new-badge ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  NEW
                </span>
              </span>
            </Link>
            <Link 
              to="/admin/users" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin/users" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-user-multiple text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">Customers</span>
            </Link>
            <Link 
              to="/admin/projects" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin/projects" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-folder-02 text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">Projects</span>
            </Link>
            <Link 
              to="/admin/invoices" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin/invoices" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-file-01 text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">Invoices</span>
            </Link>
          </div>

          <div className="space-y-1.5">
            <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Sandbox
            </p>
            <div className="sidebar-divider hidden text-slate-400 dark:text-stone-500 mb-2">
              <i className="hgi-stroke hgi-more-horizontal text-md"></i>
            </div>
            <Link 
              to="/admin/components" 
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`w-full sidebar-link ${pathname === "/admin/components" ? "active" : ""}`}
            >
              <i className="hgi-stroke hgi-grid-view text-lg"></i>
              <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">UI Components</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Sidebar / Profile */}
      <div className="mt-auto p-4 border-t border-slate-50 dark:border-slate-800">
        <div className="relative" ref={profileRef}>
          <div
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-2 transition-all hover:border-slate-100 hover:bg-slate-50 dark:hover:border-transparent dark:hover:bg-slate-800"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
              alt="User Profile"
              className="h-10 w-10 shrink-0 rounded-full border border-slate-200 dark:border-slate-700"
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="text-sm font-bold text-slate-700 dark:text-stone-200 truncate">Administrator</span>
              <span className="text-[11px] text-slate-400 dark:text-stone-500">Super User</span>
            </div>
            <i className="hgi-stroke hgi-arrow-up-01 text-slate-400 dark:text-stone-500 shrink-0"></i>
          </div>

          {/* Menu Dropdown Profile */}
          {isProfileDropdownOpen && (
            <div
              id="profileDropdown"
              className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl transition-all duration-200 dark:border-slate-800 dark:bg-slate-800"
            >
              <button
                onClick={() => { console.log("Settings Clicked"); setIsProfileDropdownOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 dark:text-stone-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
              >
                <i className="hgi-stroke hgi-settings-01 text-lg"></i>
                <span className="sidebar-text text-sm">Settings</span>
              </button>
              <button
                onClick={() => { console.log("Logout Clicked"); setIsProfileDropdownOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <i className="hgi-stroke hgi-logout-01 text-lg"></i>
                <span className="sidebar-text text-sm">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
export default Sidebar