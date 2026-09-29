import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { Alert } from './Alert';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** While true, Esc and the overlay don't close (a request is in flight). */
  busy?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Max width on desktop. Defaults to a compact dialog; `narrow` is container-narrow. */
  size?: 'sm' | 'md' | 'narrow';
}

const sizeClass = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', narrow: 'sm:max-w-[880px]' };

/**
 * §9.6: centred on desktop, bottom sheet under `sm`. Warm overlay, focus is
 * trapped inside and returned to the opener on close, Esc closes unless busy.
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, busy = false, children, footer, size = 'sm' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Read inside the keydown handler without re-binding it on every change.
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first control, or the panel itself so Tab starts inside.
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-[var(--overlay)] animate-[fade-in_var(--motion-base)_var(--ease)]"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'relative w-full flex flex-col max-h-[90vh] bg-[var(--paper-raised)] shadow-[var(--elev-3)] outline-none',
          'rounded-t-[16px] sm:rounded-[16px] border border-[var(--rule)]',
          'animate-[toast-in_var(--motion-base)_var(--ease)]',
          sizeClass[size],
        ].join(' ')}
      >
        {/* Drag handle: a visual cue that this is a sheet on mobile. */}
        <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-[var(--rule-strong)]" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4 px-6 pt-5 sm:pt-6">
          <h2 id={titleId} className="text-[17px] leading-6 font-semibold text-[var(--ink)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 w-8 h-8 -mr-2 -mt-1 inline-flex items-center justify-center rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto text-[15px] leading-6 text-[var(--ink-secondary)]">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 pb-6 pt-2">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  /** Names the action, e.g. "Delete row C" — never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive actions, `accent` for weighty but safe ones (publish). Never mixed (§3.4). */
  tone: 'danger' | 'accent';
  isLoading?: boolean;
  /** Shown inline when the action fails (e.g. a 409); the dialog stays open. */
  error?: string | null;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone,
  isLoading = false,
  error,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    busy={isLoading}
    footer={
      <>
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex flex-col gap-4">
      <div>{children}</div>
      {error && <Alert variant={tone === 'danger' ? 'danger' : 'warning'}>{error}</Alert>}
    </div>
  </Modal>
);
