import { Skeleton } from './Skeleton';

interface SelectSkeletonProps {
  className?: string;
  label?: string;
}

export const SelectSkeleton = ({
  className = '',
  label = 'Đang tải danh sách lựa chọn',
}: SelectSkeletonProps) => (
  <div role="status" aria-live="polite" aria-label={label} className={className}>
    <Skeleton className="h-[42px] w-full rounded-xl" />
  </div>
);
