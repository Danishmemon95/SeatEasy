import type React from 'react';

export interface SkeletonProps {
  className?: string;
}

/** A paper-sunken placeholder block (§8). Shaped like the content it stands in for; no spinners in content areas. */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div aria-hidden="true" className={`bg-[var(--paper-sunken)] rounded-[6px] animate-pulse ${className}`} />
);
