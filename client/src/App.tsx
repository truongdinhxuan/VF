import { Suspense } from "react";
import { PageSkeleton } from "./components/common/skeleton";
import { AppRoutes } from "./routes";

// Component hiển thị trạng thái chờ tải nhẹ nhàng khi chuyển trang
const PageLoader = () => <PageSkeleton />;

const App = () => {
  return (
    /* Bọc toàn bộ router trong Suspense để hỗ trợ tiến trình Lazy Load */
    <Suspense fallback={<PageLoader />}>
      <AppRoutes />
    </Suspense>
  );
};

export default App;
