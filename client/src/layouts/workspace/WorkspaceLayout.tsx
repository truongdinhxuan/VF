import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../components/workspace/Sidebar";
import Header from "../../components/workspace/Header";
import Footer from "../../components/workspace/Footer";
import { LiveNotificationToast } from "../../components/notifications/LiveNotificationToast";
import { useSupplyRealtime } from "../../hooks/useSupplyRealtime";

export const WorkspaceLayout = () => {
  const location = useLocation();
  const pathname = location.pathname;
  
  // --- STATE QUẢN LÝ GIAO DIỆN ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const realtime = useSupplyRealtime();

  useEffect(() => {
    // Khởi tạo Fonts & Icons...
    if (!document.getElementById("hugeicons-cdn")) {
      const link = document.createElement("link");
      link.id = "hugeicons-cdn";
      link.rel = "stylesheet";
      link.href = "https://cdn.hugeicons.com/font/hgi-stroke-rounded.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("figtree-font")) {
      const link = document.createElement("link");
      link.id = "figtree-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className="relative flex h-screen h-dvh min-h-0 w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
      <LiveNotificationToast notification={realtime.toast} onDismiss={realtime.dismissToast} />
      
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --brand-primary: #3b82f6; }
        .dark { --brand-primary: #60a5fa; }
        body { font-family: 'Figtree', sans-serif !important; }
        .sidebar-link {
          display: flex;
          cursor: pointer;
          align-items: center;
          gap: 12px;
          border-radius: 8px;
          padding: 10px 14px;
          font-weight: 500;
          color: #475569;
          transition: all 0.2s ease;
        }
        .sidebar-link:hover {
          background-color: #f1f5f9;
          color: #2563eb;
        }
        .sidebar-link.active {
          background-color: #eff6ff;
          font-weight: 600;
          color: #2563eb;
        }
        
        aside.sidebar-collapsed { width: 80px !important; align-items: center; }
        aside.sidebar-collapsed .sidebar-text,
        aside.sidebar-collapsed .new-badge { display: none !important; }
        aside.sidebar-collapsed .sidebar-link {
          width: 44px !important;
          height: 44px !important;
          padding: 0 !important;
          justify-content: center !important;
          margin: 0 auto;
        }
        aside.sidebar-collapsed .sidebar-link i,
        aside.sidebar-collapsed .sidebar-link svg { font-size: 20px !important; margin: 0 !important; }
      `}} />

      {/* LỚP PHỦ MỜ KHI MỞ SIDEBAR TRÊN MOBILE */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR COMPONENT */}
      <Sidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        pathname={pathname}
        isProfileDropdownOpen={isProfileDropdownOpen}
        setIsProfileDropdownOpen={setIsProfileDropdownOpen}
        profileRef={profileRef}
      />

      {/* MAIN WORKSPACE */}
      <main className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-50">
        {/* Background blobs */}
        <div className="pointer-events-none absolute right-0 top-0 -m-32 h-96 w-96 rounded-full bg-blue-100 opacity-40 mix-blend-multiply blur-3xl filter"></div>
        <div className="pointer-events-none absolute right-48 top-0 -m-32 h-96 w-96 rounded-full bg-purple-100 opacity-40 mix-blend-multiply blur-3xl filter"></div>

        {/* HEADER COMPONENT */}
        <Header 
          isSidebarCollapsed={isSidebarCollapsed}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isNotificationsOpen={isNotificationsOpen}
          setIsNotificationsOpen={setIsNotificationsOpen}
          notificationRef={notificationRef}
        />

        <div className="z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:px-10">
          <div className="mx-auto max-w-7xl space-y-6"> 
            <Outlet context={{ searchQuery, setSearchQuery }} />
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
