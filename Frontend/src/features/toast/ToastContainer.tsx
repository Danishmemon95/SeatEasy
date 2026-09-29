import type React from 'react';
import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { dismissToast, type Toast } from './toastSlice';

const TOAST_DURATION_MS = 4000;

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = window.setTimeout(() => dispatch(dismissToast(toast.id)), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [dispatch, toast.id]);

  const icon =
    toast.tone === 'success' ? (
      <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
    ) : toast.tone === 'danger' ? (
      <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
    ) : null;

  return (
    <div className="pointer-events-auto flex items-center gap-3 min-w-0 max-w-sm w-full sm:w-auto px-4 py-3 rounded-[10px] bg-[var(--paper-raised)] border border-[var(--rule)] shadow-[var(--elev-2)] text-sm text-[var(--ink)] animate-[toast-in_var(--motion-base)_var(--ease)]">
      {icon}
      <span className="flex-1 min-w-0">{toast.message}</span>
      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        aria-label="Dismiss"
        className="shrink-0 w-7 h-7 -mr-1.5 inline-flex items-center justify-center rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/**
 * Non-blocking confirmations: bottom-right on desktop, bottom-centre on mobile.
 * The live region is always mounted so screen readers pick up new messages.
 */
export const ToastContainer: React.FC = () => {
  const toasts = useAppSelector((state) => state.toast.items);

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed z-50 bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 flex flex-col items-center sm:items-end gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};
