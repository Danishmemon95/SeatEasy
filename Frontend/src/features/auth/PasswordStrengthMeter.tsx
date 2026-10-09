import type React from 'react';
import { Check, X } from 'lucide-react';
import { evaluatePasswordStrength } from '../../utils/validation';

/**
 * Strength bar plus the rule checklist for choosing a new password. Used by
 * register, reset password and change password, so all three show the same
 * rules the backend enforces. Renders nothing until something is typed.
 */
export const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (password.length === 0) return null;

  const evaluation = evaluatePasswordStrength(password);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-[6px] bg-[var(--paper-sunken)] border border-[var(--rule)]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--ink-muted)] font-medium">Security strength:</span>
        <span className="font-medium capitalize" style={{ color: evaluation.color }}>
          {evaluation.label}
        </span>
      </div>

      {/* Visual strength bar */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className="rounded-full h-full transition-all duration-300"
            style={{
              backgroundColor: evaluation.score >= step ? evaluation.color : 'var(--rule)',
            }}
          />
        ))}
      </div>

      {/* Checklist of security requirements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
        {evaluation.rules.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${
              rule.passed ? 'text-[var(--success)] font-medium' : 'text-[var(--ink-muted)]'
            }`}
          >
            {rule.passed ? (
              <Check className="w-3 h-3 text-[var(--success)] shrink-0" />
            ) : (
              <X className="w-3 h-3 text-[var(--ink-muted)] opacity-60 shrink-0" />
            )}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
