import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'danger' | 'success' | 'warning' | 'info';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
  ...props
}) => {
  const iconMap: Record<AlertVariant, React.ReactNode> = {
    danger: <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />,
    info: <Info className="w-4 h-4 text-[var(--info)] shrink-0" />,
  };

  const styleMap: Record<AlertVariant, string> = {
    danger: 'bg-[var(--danger-subtle)] border-[var(--danger)]/20 text-[var(--danger)]',
    success: 'bg-[var(--success-subtle)] border-[var(--success)]/20 text-[var(--success)]',
    warning: 'bg-[var(--warning-subtle)] border-[var(--warning)]/20 text-[var(--warning)]',
    info: 'bg-[var(--info-subtle)] border-[var(--info)]/20 text-[var(--info)]',
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-[4px] border text-sm leading-5 ${styleMap[variant]} ${className}`}
      {...props}
    >
      <div className="mt-0.5">{iconMap[variant]}</div>
      <div className="flex-1 text-[var(--ink-secondary)] text-[13px] leading-5">
        {title && <div className="font-medium text-[var(--ink)] mb-0.5">{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer p-0.5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
