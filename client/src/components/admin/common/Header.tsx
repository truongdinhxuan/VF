import React from "react";

// Định nghĩa Props cho Component Header
interface HeaderProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  setIsMobileSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  notificationRef: React.RefObject<HTMLDivElement | null>;
}

const Header = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  setIsMobileSidebarOpen,
  searchQuery,
  setSearchQuery,
  isNotificationsOpen,
  setIsNotificationsOpen,
  notificationRef,
}: HeaderProps) => {
  return (
    <header className="z-20 mx-4 mt-4 flex min-h-14 shrink-0 items-center justify-between rounded-3xl border border-slate-100 bg-white px-4 shadow-sm sm:mx-6 sm:mt-6 sm:min-h-16 sm:px-680">
      
      <div className="flex items-center gap-4">
        {/* Nút mở Sidebar trên Mobile */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="mobile-menu-toggle block md:hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <i className="hgi-stroke hgi-menu-05 text-xl"></i>
        </button>

        {/* Nút thu gọn Sidebar trên Desktop */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:block rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <i className={`hgi-stroke text-xl ${isSidebarCollapsed ? "hgi-menu-01" : "hgi-menu-05"}`}></i>
        </button>
        
        {/* <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-500/10 dark:text-blue-400">
          Vite + React
        </span> */}
      </div>

      {/* Hành động & Tiện ích Header */}
      <div className="flex items-center gap-4">
        {/* Ô Tìm Kiếm */}
        <div className="relative hidden lg:block">
          <i className="hgi-stroke hgi-search-01 absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-64 rounded-xl border-none bg-slate-100/50 py-2 pl-10 pr-4 text-sm font-medium text-slate-700 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <i className="hgi-stroke hgi-cancel-01 text-sm"></i>
            </button>
          )}
        </div>

        <div className="hidden h-6 w-px bg-slate-200 sm:block "></div>

        {/* Chuông & Panel Thông báo */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:text-slate-800  hover:bg-slate-100 "
          >
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-red-500 "></span>
            <i className="hgi-stroke hgi-notification-01 text-2xl"></i>
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 z-50 mt-3 w-80 rounded-2xl border border-slate-100 bg-white shadow-xl ">
              <div className="flex items-center justify-between border-b border-slate-100 p-4 ">
                <h3 className="font-bold text-slate-800 ">Notifications</h3>
                <button onClick={() => console.log("Marked read")} className="text-xs font-semibold text-blue-600 hover:text-blue-700 ">
                  Mark all as read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <div className="flex items-start gap-4 border-b border-slate-50 p-4 transition-colors hover:bg-slate-50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ">
                    <i className="hgi-stroke hgi-user text-md"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 ">New customer signed up</p>
                    <p className="text-xs text-slate-500 ">Sarah Connor joined pro plan.</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-400">2 MINS AGO</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
export default Header