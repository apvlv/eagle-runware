import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-skeleton-pulse rounded bg-bg-elevated ${className}`}
    />
  );
}
