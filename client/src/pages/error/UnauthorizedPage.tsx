import { Link } from "react-router-dom";

const UnauthorizedPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-bold text-red-600">403</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Không có quyền truy cập</h1>
      <p className="mt-3 text-sm text-slate-500">
        Tài khoản chưa được gán một trong bốn role hoặc không có quyền mở trang này.
      </p>
      <Link
        to="/admin/dashboard"
        className="mt-6 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Về dashboard
      </Link>
    </div>
  </main>
);

export default UnauthorizedPage;
