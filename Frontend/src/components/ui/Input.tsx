import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Leading icon — optional by design (§9.2: default to off, use only when field type is ambiguous) */
  leftIcon?: React.ReactNode;
  /** Trailing adornment (password reveal, clear, unit). Gets 32px radius-full hit area with paper-sunken hover. */
  rightAdornment?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightAdornment,
      id,
      className = '',
      containerClassName = '',
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    /*
     * Updated per §9.2:
     *   - Height 44px (h-11), radius-md (10px), 14px horizontal padding
     *   - Hover: rule-strong border + warm tint (#FFFDFB)
     *   - Focus: accent border + 3px accent-subtle ring (transitions in)
     *   - Leading icons default to off
     *   - Adornments get 32px radius-full hit area + paper-sunken hover fill
     */

    return (
      <div className={`flex flex-col gap-1.5 w-full text-left ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-caption text-[var(--ink-muted)] flex items-center justify-between select-none"
          >
            <span>{label}</span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--ink-muted)]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={[
              'w-full h-11 font-sans text-[15px] leading-6 bg-[var(--paper-raised)] text-[var(--ink)]',
              'placeholder:text-[var(--ink-faint)] rounded-[10px] border',
              'transition-[border-color,box-shadow,background] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
              leftIcon ? 'pl-10' : 'px-3.5',
              rightAdornment ? 'pr-11' : leftIcon ? 'pr-3.5' : '',
              error
                ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_var(--danger-subtle)] focus:outline-none'
                : [
                    'border-[var(--rule)]',
                    'hover:border-[var(--rule-strong)] hover:bg-[#FFFDFB]',
                    'focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-subtle)] focus:outline-none',
                  ].join(' '),
              disabled ? 'bg-[var(--paper-sunken)] text-[var(--ink-faint)] cursor-not-allowed opacity-75' : '',
              className,
            ].filter(Boolean).join(' ')}
            {...props}
          />

          {rightAdornment && (
            <div className="absolute right-1.5 flex items-center">
              {rightAdornment}
            </div>
          )}
        </div>

        {error ? (
          <div id={errorId} className="flex items-center gap-1.5 text-[13px] text-[var(--danger)] mt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : helperText ? (
          <p id={helperId} className="text-[13px] text-[var(--ink-muted)] mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
