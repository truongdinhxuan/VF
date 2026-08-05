import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch";
import { AppTooltip } from "../common/AppTooltip";
import { getButtonClassName, IconButton, TextButton } from "../common/Button";

interface HeaderProps {
  isSidebarCollapsed: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  notificationRef: React.RefObject<HTMLDivElement | null>;
}

const Header = ({
  isSidebarCollapsed,
  setIsMobileSidebarOpen,
  searchQuery,
  setSearchQuery,
  isNotificationsOpen,
  setIsNotificationsOpen,
  notificationRef,
}: HeaderProps) => {
  return (
     <header className={`z-20 mx-3 mt-4 duration-300 ease-in-out flex min-h-14 shrink-0 items-center justify-between rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl px-4 shadow-xl sm:mx-6 sm:mt-6 sm:min-h-16 sm:px-6

      ${isSidebarCollapsed ? "md:mx-130 hover:scale-105 hover:bg-white" : "md:mx-10"}

    `}>      
      <div className="flex items-center gap-4">
        {/* Nút Hamburger cho Mobile (< 768px) */}
        <AppTooltip content="Mở menu" side="bottom">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className={`${IconButton} md:hidden`}
            aria-label="Mở menu"
          >
            <i className="hgi-stroke hgi-menu-05 text-2xl" aria-hidden="true"></i>
          </button>
        </AppTooltip>

        {/* Tiêu đề hoặc Welcome Text (Tuỳ chọn cho mobile đỡ trống) */}
        {/* <h2 className="hidden sm:block text-lg font-semibold text-slate-800">
          Good Morning!
        </h2> */}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Thanh tìm kiếm (Ẩn ở mobile nhỏ, hiện ở màn hình vừa và lớn) */}
        <div className="relative hidden md:block">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-48 lg:w-64 xl:w-80 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-medium text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {searchQuery && (
            <AppTooltip content="Xóa tìm kiếm" side="bottom">
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={getButtonClassName({
                  variant: "icon",
                  size: "xs",
                  className: "absolute right-2 top-1/2 -translate-y-1/2 text-slate-400",
                })}
                aria-label="Xóa tìm kiếm"
              >
                <i className="hgi-stroke hgi-cancel-01 text-sm" aria-hidden="true"></i>
              </button>
            </AppTooltip>
          )}
        </div>

        <div className="hidden h-6 w-px bg-slate-300 md:block"></div>

        {/* Nút Thông Báo */}
        <div className="relative" ref={notificationRef}>
          <AppTooltip content="Thông báo" side="bottom">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`${IconButton} relative`}
              aria-label="Mở thông báo"
              aria-expanded={isNotificationsOpen}
              aria-haspopup="menu"
            >
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" aria-hidden="true"></span>
              <i className="hgi-stroke hgi-notification-01 text-2xl" aria-hidden="true"></i>
            </button>
          </AppTooltip>

          {/* Bảng Dropdown Thông Báo */}
          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-3 w-[300px] sm:w-[360px] z-50 rounded-2xl border border-slate-100 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <h3 className="font-bold text-slate-800">Notifications</h3>
                <button type="button" className={TextButton}>Mark all as read</button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                <div className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 cursor-pointer">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <i className="hgi-stroke hgi-user text-lg"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">New customer signed up</p>
                    <p className="text-xs text-slate-500 mt-0.5">Sarah Connor joined pro plan.</p>
                    <p className="mt-1.5 text-[10px] font-bold text-slate-400">2 MINS AGO</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Hình Tròn góc phải (Mobile) */}
        <div className="flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white p-1 transition-all hover:bg-slate-50 md:hidden">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
            alt="User Profile"
            className="h-8 w-8 rounded-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}

export default Header;
