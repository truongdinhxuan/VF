import { Skeleton } from './Skeleton';

export const PageSkeleton = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Đang tải trang"
    className="min-h-screen bg-slate-50 p-4 sm:p-6"
  >
    <div aria-hidden="true" className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <Skeleton className="h-10 w-full sm:w-72" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  </div>
);
