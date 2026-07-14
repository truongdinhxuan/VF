import { useAuth } from "../../../context/AuthContext";

const DashboardPage = () => {
  const { user, role } = useAuth();
  const displayName = user?.publicData.full_name || user?.publicData.email || "Người dùng";

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Dashboard</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Xin chào, {displayName}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Khung quản trị hiện tại đã được giữ nguyên và chuẩn hóa route theo Application.xlsx.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Role hiện tại</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{role ?? "Chưa được gán"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Trạng thái triển khai</p>
          <p className="mt-2 text-lg font-bold text-slate-900">Routing và permission menu</p>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
