import { useLocation, useParams } from "react-router-dom";

interface AdminPlaceholderPageProps {
  title: string;
  description: string;
}

const AdminPlaceholderPage = ({ title, description }: AdminPlaceholderPageProps) => {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Frontend foundation
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          {id && <p className="mt-2 text-xs text-slate-400">Order ID: {id}</p>}
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Sẵn sàng cho CRUD UI
        </span>
      </div>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
        Route đã sẵn sàng trong AdminLayout: {location.pathname}
      </div>
    </section>
  );
};

export default AdminPlaceholderPage;
