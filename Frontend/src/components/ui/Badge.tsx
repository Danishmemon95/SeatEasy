import React from 'react';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    neutral: 'bg-[var(--paper-sunken)] text-[var(--ink-secondary)] border-[var(--rule)]',
    accent: 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-border)]',
    success: 'bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/20',
    warning: 'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/20',
    danger: 'bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/20',
    info: 'bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info)]/20',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[6px] border text-caption font-medium tracking-[0.06em] select-none ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
