interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className = '' }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-slate-200 motion-reduce:animate-none ${className}`}
  />
);
