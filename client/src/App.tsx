import React, { Suspense } from "react";
import { AppRoutes } from "./routes";

// Component hiển thị trạng thái chờ tải nhẹ nhàng khi chuyển trang
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
      <p className="mt-4 text-sm font-semibold text-slate-500">Đang tải trang...</p>
    </div>
  </div>
);

const App = () => {
  return (
    /* Bọc toàn bộ router trong Suspense để hỗ trợ tiến trình Lazy Load */
    <Suspense fallback={<PageLoader />}>
      <AppRoutes />
    </Suspense>
  );
};

export default App;