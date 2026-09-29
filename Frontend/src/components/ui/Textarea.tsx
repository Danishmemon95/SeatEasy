import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Shows a `1240 / 5000` counter; pair with the validator's max, not `maxLength`, so over-long pastes stay visible. */
  maxChars?: number;
  containerClassName?: string;
}

/** Multi-line Input (§9.2) with an optional character counter in tabular figures. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, helperText, maxChars, id, className = '', containerClassName = '', disabled, value, rows = 4, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;
    const length = typeof value === 'string' ? value.length : 0;
    const over = maxChars !== undefined && length > maxChars;

    return (
      <div className={`flex flex-col gap-1.5 w-full text-left ${containerClassName}`}>
        {(label || maxChars !== undefined) && (
          <div className="flex items-center justify-between gap-3">
            {label && (
              <label htmlFor={textareaId} className="text-caption text-[var(--ink-muted)] select-none">
                {label}
              </label>
            )}
            {maxChars !== undefined && (
              <span
                className={`text-[12px] tabular-nums ml-auto ${over ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'}`}
                aria-hidden="true"
              >
                {length} / {maxChars}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={[
            'w-full px-3.5 py-2.5 font-sans text-[15px] leading-6 bg-[var(--paper-raised)] text-[var(--ink)] resize-y',
            'placeholder:text-[var(--ink-faint)] rounded-[10px] border',
            'transition-[border-color,box-shadow,background] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
            error
              ? 'border-[var(--danger)] focus:shadow-[0_0_0_3px_var(--danger-subtle)] focus:outline-none'
              : 'border-[var(--rule)] hover:border-[var(--rule-strong)] hover:bg-[#FFFDFB] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-subtle)] focus:outline-none',
            disabled ? 'bg-[var(--paper-sunken)] text-[var(--ink-faint)] cursor-not-allowed opacity-75' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
