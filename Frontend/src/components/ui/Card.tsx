import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  isInteractive?: boolean;
  elevation?: '0' | '1' | '2' | '3';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, isInteractive = false, elevation = '0', className = '', ...props }, ref) => {
    /* Updated to radius-lg (16px) per new §6.1 — cards are large elements */
    const elevationClasses = {
      '0': 'border border-[var(--rule)]',
      '1': 'border border-[var(--rule)] shadow-[var(--elev-1)]',
      '2': 'border border-[var(--rule)] shadow-[var(--elev-2)]',
      '3': 'border border-[var(--rule)] shadow-[var(--elev-3)]',
    };

    const interactiveStyles = isInteractive
      ? 'transition-[border-color,box-shadow,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:border-[var(--rule-strong)] hover:shadow-[var(--elev-1)] hover:-translate-y-px cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        className={`bg-[var(--paper-raised)] rounded-[16px] p-6 text-[var(--ink)] ${elevationClasses[elevation]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
