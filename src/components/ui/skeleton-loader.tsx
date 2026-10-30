import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text' | 'card';
  width?: string | number;
  height?: string | number;
}

export function SkeletonLoader({
  className,
  variant = 'text',
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full aspect-square';
      case 'card':
        return 'rounded-xl h-32 w-full';
      case 'rectangular':
        return 'rounded-md';
      case 'text':
      default:
        return 'rounded h-4 w-full';
    }
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-slate-800/60 border border-slate-700/20',
        getVariantStyles(),
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonCardGroup({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
          <SkeletonLoader variant="rectangular" height={24} width="60%" />
          <SkeletonLoader variant="text" width="90%" />
          <SkeletonLoader variant="text" width="40%" />
          <div className="pt-2 flex justify-between items-center">
            <SkeletonLoader variant="circular" width={32} height={32} />
            <SkeletonLoader variant="rectangular" width={80} height={28} className="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SkeletonLoader;
