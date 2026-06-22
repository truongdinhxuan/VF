import React from "react";
import { Link } from "react-router-dom";

// ==========================================
// --- ĐỊNH NGHĨA INTERFACES & TYPES ---
// ==========================================
interface SidebarProps {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  pathname: string;
  isProfileDropdownOpen: boolean;
  setIsProfileDropdownOpen: (open: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement | null>;
}

interface NavItem {
  to: string;
  label: string;
  iconClass: string;
  badge?: string;
}

// ==========================================
// --- KHAI BÁO CÁC MẢNG LIÊN KẾT NGOÀI COMPONENT ---
// ==========================================
const overviewLinks: NavItem[] = [
  { to: "/admin", label: "Dashboard", iconClass: "hgi-stroke hgi-home-01" },
  { to: "/admin/analytics", label: "Analytics", iconClass: "hgi-stroke hgi-analytics-01" }
];

const pagesLinks: NavItem[] = [
  { to: "/admin/ecommerce", label: "E-Commerce", iconClass: "hgi-stroke hgi-shopping-cart-01", badge: "NEW" },
  { to: "/admin/users", label: "Customers", iconClass: "hgi-stroke hgi-user-multiple" },
  { to: "/admin/projects", label: "Projects", iconClass: "hgi-stroke hgi-folder-02" },
  { to: "/admin/invoices", label: "Invoices", iconClass: "hgi-stroke hgi-file-01" }
];

const sandboxLinks: NavItem[] = [
  { to: "/admin/components", label: "UI Components", iconClass: "hgi-stroke hgi-grid-view" }
];


// ==========================================
// --- COMPONENT SIDEBAR (ARROW FUNCTION) ---
// ==========================================
const Sidebar = ({
  isSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  pathname,
  isProfileDropdownOpen,
  setIsProfileDropdownOpen,
  profileRef,
}: SidebarProps) => {
  
  // Hàm kiểm tra trạng thái active của link
  const checkActive = (to: string) => {
    return pathname === to || (to === "/admin" && pathname === "/admin/");
  };

  return (
    <aside 
      id="sidebar" 
      className={`z-40 flex shrink-0 flex-col justify-between border-r border-slate-100 bg-white transition-all duration-300 ease-in-out m-4 rounded-3xl shadow-2xl
        ${isSidebarCollapsed ? "w-20 sidebar-collapsed" : "w-80"} 
        ${isMobileSidebarOpen ? "mobile-open" : ""}`}
    >
      <div className="p-6">
        {/* Vùng Logo VinFast */}
        <Link to="/admin" className="mb-10 flex cursor-pointer items-center gap-3 px-2">
          <img 
            className="w-9 m-auto" 
            src="https://upload.wikimedia.org/wikipedia/commons/4/43/VinFast_logo_%28simple_variant%29.svg"
            alt="VinFast Logo"
          />
          {/* <span className="sidebar-text text-2xl font-extrabold tracking-tight text-black">
            Admin<span className="text-blue-600 dark:text-blue-500 font-bold font-sans">Page</span>
          </span> */}
        </Link>

        {/* Các nhóm liên kết điều hướng */}
        <div className="flex flex-col gap-6">
          
          {/* Nhóm 1: OVERVIEW */}
          <div className="space-y-1.5">
            <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Overview
            </p>
            <div className="sidebar-divider hidden text-slate-400">
              <i className="hgi-stroke hgi-more-horizontal text-md"></i>
            </div>
            {overviewLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`w-full sidebar-link ${checkActive(link.to) ? "active" : ""}`}
              >
                <i className={`${link.iconClass} text-lg`}></i>
                <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Nhóm 2: PAGES */}
          <div className="space-y-1.5">
            <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Pages
            </p>
            <div className="sidebar-divider hidden text-slate-400 ">
              <i className="hgi-stroke hgi-more-horizontal text-md"></i>
            </div>
            {pagesLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`w-full sidebar-link ${checkActive(link.to) ? "active" : ""}`}
              >
                <i className={`${link.iconClass} text-lg`}></i>
                <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm flex items-center w-full">
                  {link.label}
                  {link.badge && (
                    <span className="new-badge ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                      {link.badge}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>

          {/* Nhóm 3: SANDBOX */}
          <div className="space-y-1.5">
            <p className="sidebar-text mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Sandbox
            </p>
            <div className="sidebar-divider hidden text-slate-400">
              <i className="hgi-stroke hgi-more-horizontal text-md"></i>
            </div>
            {sandboxLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`w-full sidebar-link ${checkActive(link.to) ? "active" : ""}`}
              >
                <i className={`${link.iconClass} text-lg`}></i>
                <span className="sidebar-text whitespace-nowrap overflow-hidden text-sm">
                  {link.label}
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
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-2 transition-all hover:border-slate-100 hover:bg-slate-50"
          >
            {/* Next update chỗ này sẽ thay bằng dynamic image */}
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
              alt="User Profile"
              className="h-10 w-10 shrink-0 rounded-full shadow border-slate-200"
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Tên */}
              <span className="text-sm font-bold text-slate-700 truncate">Đinh Xuân Trường</span>
              {/* Role */}
              <span className="text-[11px] text-slate-400">Tổ trưởng dữ liệu</span>
            </div>
            <i className="hgi-stroke hgi-arrow-up-01 text-slate-400 shrink-0"></i>
          </div>

          {/* Profile Dropdown Menu */}
          {isProfileDropdownOpen && (
            <div
              id="profileDropdown"
              className="absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl transition-all duration-200"
            >
              <button
                onClick={() => { console.log("Settings Clicked"); setIsProfileDropdownOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600"
              >
                <i className="hgi-stroke hgi-settings-01 text-lg"></i>
                <span className="sidebar-text text-sm">Settings</span>
              </button>
              <button
                onClick={() => { console.log("Logout Clicked"); setIsProfileDropdownOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-600"
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
};

export default Sidebar;