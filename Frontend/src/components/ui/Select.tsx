import React from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  /** Shown as a disabled first option when no value is selected. */
  placeholder?: string;
  containerClassName?: string;
}

/**
 * Native <select> in the Input shell (§9.2): 44px, caption label above, error
 * slot below. Native for keyboard and screen-reader behaviour for free.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, helperText, options, placeholder, id, className = '', containerClassName = '', disabled, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    return (
      <div className={`flex flex-col gap-1.5 w-full text-left ${containerClassName}`}>
        {label && (
          <label htmlFor={selectId} className="text-caption text-[var(--ink-muted)] select-none">
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={[
              'appearance-none w-full h-11 pl-3.5 pr-10 font-sans text-[15px] leading-6 bg-[var(--paper-raised)] text-[var(--ink)]',
              'rounded-[10px] border cursor-pointer',
              'transition-[border-color,box-shadow,background] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
              error
                ? 'border-[var(--danger)] focus:shadow-[0_0_0_3px_var(--danger-subtle)] focus:outline-none'
                : 'border-[var(--rule)] hover:border-[var(--rule-strong)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-subtle)] focus:outline-none',
              disabled ? 'bg-[var(--paper-sunken)] text-[var(--ink-faint)] cursor-not-allowed opacity-75' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 w-4 h-4 text-[var(--ink-muted)] pointer-events-none" />
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
  },
);

Select.displayName = 'Select';
