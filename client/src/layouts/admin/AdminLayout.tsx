import React, { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation, useOutletContext } from "react-router-dom";
import Sidebar from "../../components/admin/common/SideBar"; // Import Sidebar từ file riêng
import Header from "../../components/admin/common/Header";   // Import Header từ file riêng
import Footer from "../../components/admin/common/Footer";

// --- MAIN LAYOUT COMPONENT (DEFAULT EXPORT) ---
export const AdminLayout = () =>{
  const location = useLocation();
  const pathname = location.pathname;
  
  // --- STATE QUẢN LÝ GIAO DIỆN CHUNG ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  
  // --- STATE QUẢN LÝ DROPDOWNS & MODALS ---
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isChatSheetOpen, setIsChatSheetOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // --- EFFECT KHỞI TẠO STYLESHEETS & DARK MODE ---
  useEffect(() => {
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

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#0f172a] dark:text-stone-50">
      
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --brand-primary: #3b82f6; }
        .dark { --brand-primary: #60a5fa; }
        body { font-family: 'Figtree', sans-serif !important; }
        .glass-panel {
          border: 1px solid rgba(255, 255, 255, 0.4);
          background-color: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
        }
        .dark .glass-panel {
          border-color: rgba(255, 255, 255, 0.05);
          background-color: rgba(30, 41, 59, 0.8);
        }
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
        .dark .sidebar-link { color: #94a3b8; }
        .sidebar-link:hover {
          background-color: #f1f5f9;
          color: #2563eb;
        }
        .dark .sidebar-link:hover {
          background-color: #1e293b;
          color: #60a5fa;
        }
        .sidebar-link.active {
          background-color: #eff6ff;
          font-weight: 600;
          color: #2563eb;
        }
        .dark .sidebar-link.active {
          background-color: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
        }
        .stat-card {
          cursor: pointer;
          border-radius: 16px;
          background-color: #ffffff;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dark .stat-card { background-color: #1e293b; }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in-up 0.4s ease-out forwards; }
        
        aside.sidebar-collapsed { width: 80px !important; align-items: center; }
        aside.sidebar-collapsed .sidebar-text,
        aside.sidebar-collapsed .new-badge,
        aside.sidebar-collapsed [data-dropdown-toggle] .flex-1,
        aside.sidebar-collapsed [data-dropdown-toggle] > i { display: none !important; }
        aside.sidebar-collapsed .sidebar-link {
          width: 44px !important;
          height: 44px !important;
          padding: 0 !important;
          justify-content: center !important;
          margin: 0 auto;
        }
        aside.sidebar-collapsed .sidebar-link i { font-size: 20px !important; margin: 0 !important; }
        aside.sidebar-collapsed .sidebar-divider { display: block !important; margin: 8px auto !important; text-align: center; }
        aside.sidebar-collapsed .mb-10 { justify-content: center; padding: 0; }
        aside.sidebar-collapsed .mt-auto > div { justify-content: center; padding: 12px 0 !important; }
        aside.sidebar-collapsed #profileDropdown { left: 50% !important; transform: translateX(-50%) !important; bottom: 100% !important; width: 160px; }

        @media (max-width: 767px) {
          aside {
            position: fixed !important;
            top: 0;
            left: 0;
            height: 100vh !important;
            z-index: 50 !important;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 4px 0 24px rgba(0,0,0,0.12);
          }
          aside.mobile-open { transform: translateX(0) !important; }
          main { width: 100vw !important; }
        }
      `}} />

      {/* --- SIDEBAR COMPONENT CON (Imported) --- */}
      <Sidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        pathname={pathname}
        isProfileDropdownOpen={isProfileDropdownOpen}
        setIsProfileDropdownOpen={setIsProfileDropdownOpen}
        profileRef={profileRef}
        isDarkMode={isDarkMode}
      />

      {/* --- MAIN WORKSPACE --- */}
      <main className="relative flex h-screen flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#0f172a]">
        
        {/* Các hình nền chuyển động mờ */}
        <div className="pointer-events-none absolute right-0 top-0 -m-32 h-96 w-96 rounded-full bg-blue-100 opacity-40 mix-blend-multiply blur-3xl filter dark:bg-blue-900/10"></div>
        <div className="pointer-events-none absolute right-48 top-0 -m-32 h-96 w-96 rounded-full bg-purple-100 opacity-40 mix-blend-multiply blur-3xl filter dark:bg-purple-900/10"></div>

        {/* --- HEADER COMPONENT CON (Imported) --- */}
        <Header 
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isNotificationsOpen={isNotificationsOpen}
          setIsNotificationsOpen={setIsNotificationsOpen}
          notificationRef={notificationRef}
          setIsChatSheetOpen={setIsChatSheetOpen}
        />
        <div className="z-10 flex-1 overflow-y-auto p-4 sm:p-6 sm:px-10">
          <div className="mx-auto max-w-7xl space-y-6"> 
            <Outlet context={{
              searchQuery,
              setSearchQuery,
            }} />
          </div>
        </div>
          <Footer/>
      </main>
    </div>
  );
}