import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    /*
     * Buttons use radius-md (10px) per updated §9.1.
     * Primary gets micro-lift translateY(-1px) + warm oxblood shadow on hover,
     * snaps back on active. Secondary/ghost get paper-sunken hover, no shadow.
     * Focus-visible uses 2px accent outline with 2px offset.
     * Label copy: verb-first, short, no product name.
     */
    const baseStyles =
      'inline-flex items-center justify-center font-sans font-medium rounded-[10px] select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

    const variantStyles: Record<ButtonVariant, string> = {
      primary: [
        'bg-[var(--accent)] text-[var(--accent-ink)] border border-transparent',
        'transition-[background-color,box-shadow,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'hover:bg-[var(--accent-hover)] hover:shadow-[0_2px_8px_rgba(107,39,55,0.24)] hover:-translate-y-px',
        'active:bg-[var(--accent-active)] active:translate-y-0 active:shadow-none',
        'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
      ].join(' '),
      secondary: [
        'bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--rule-strong)]',
        'transition-[background-color,box-shadow,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'hover:bg-[var(--paper-sunken)] hover:-translate-y-px',
        'active:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-[var(--rule-strong)] focus-visible:outline-offset-2',
      ].join(' '),
      ghost: [
        'bg-transparent text-[var(--ink-secondary)] border border-transparent',
        'transition-[background-color,color,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'hover:bg-[var(--paper-sunken)] hover:text-[var(--ink)] hover:-translate-y-px',
        'active:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-[var(--rule)] focus-visible:outline-offset-2',
      ].join(' '),
      danger: [
        'bg-[var(--danger)] text-[var(--ink-inverse)] border border-transparent',
        'transition-[background-color,box-shadow,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'hover:opacity-90 hover:-translate-y-px',
        'active:translate-y-0 active:opacity-100',
        'focus-visible:outline-2 focus-visible:outline-[var(--danger)] focus-visible:outline-offset-2',
      ].join(' '),
      link: [
        'bg-transparent text-[var(--accent)] border border-transparent p-0 h-auto font-normal',
        'bg-[linear-gradient(var(--accent),var(--accent))] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat',
        'transition-[background-size] duration-[200ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'hover:bg-[length:100%_1px]',
        'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
      ].join(' '),
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-[15px] gap-2.5',
    };

    const combinedClasses = [
      baseStyles,
      variantStyles[variant],
      variant !== 'link' ? sizeStyles[size] : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={combinedClasses}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
