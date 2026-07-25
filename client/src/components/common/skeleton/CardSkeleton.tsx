import { Skeleton } from './Skeleton';

interface CardSkeletonProps {
  lines?: number;
  className?: string;
  label?: string;
}

export const CardSkeleton = ({
  lines = 5,
  className = '',
  label = 'Đang tải dữ liệu',
}: CardSkeletonProps) => (
  <div
    role="status"
    aria-live="polite"
    aria-label={label}
    className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
  >
    <div aria-hidden="true" className="space-y-4">
      <Skeleton className="h-6 w-48 max-w-full" />
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className={`h-4 ${index % 2 === 0 ? 'w-3/4' : 'w-full'}`} />
        </div>
      ))}
    </div>
  </div>
);
