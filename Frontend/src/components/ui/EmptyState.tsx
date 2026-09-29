import type React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  /** One action, at most. */
  action?: React.ReactNode;
  className?: string;
}

/** §8: an h3 line, a muted body-sm explanation and one action. No illustration. */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center gap-2 py-16 px-6 ${className}`}>
    <h3 className="text-[20px] leading-7 font-semibold tracking-[-0.005em] text-[var(--ink)]">{title}</h3>
    {description && <p className="text-[13px] leading-5 text-[var(--ink-muted)] max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
