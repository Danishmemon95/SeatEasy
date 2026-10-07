import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

export interface EmptyStateProps {
  /** @deprecated Use `heading` instead. Kept for backward compat. */
  title?: string;
  heading?: string;
  description?: React.ReactNode;
  /** Icon node to display above the heading. */
  icon?: React.ReactNode;
  /** One action: either a ReactNode or an object with label/href/onClick. */
  action?: React.ReactNode | { label: string; href?: string; onClick?: () => void };
  className?: string;
}

/** §8: an h3 line, a muted body-sm explanation and one action. No illustration. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  heading,
  description,
  icon,
  action,
  className = '',
}) => {
  const headingText = heading ?? title;

  const renderAction = () => {
    if (!action) return null;
    if (React.isValidElement(action)) {
      return action;
    }
    if (typeof action === 'object' && 'label' in action && action.label) {
      if (action.href) {
        return (
          <Link
            to={action.href}
            className="px-4 py-2 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors inline-block"
          >
            {action.label}
          </Link>
        );
      }
      return (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      );
    }
    return action as React.ReactNode;
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-16 px-6 ${className}`}>
      {icon && (
        <span className="text-[var(--ink-faint)] mb-1">{icon}</span>
      )}
      {headingText && (
        <h3 className="text-[20px] leading-7 font-semibold tracking-[-0.005em] text-[var(--ink)]">
          {headingText}
        </h3>
      )}
      {description && (
        <p className="text-[13px] leading-5 text-[var(--ink-muted)] max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-2">
          {renderAction()}
        </div>
      )}
    </div>
  );
};
