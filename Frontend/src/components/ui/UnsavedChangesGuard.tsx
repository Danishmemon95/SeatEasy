import type React from 'react';
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from './Modal';

/**
 * While `when` is true, leaving the page asks first: in-app navigation shows a
 * dialog, and closing or reloading the tab gets the browser's own prompt.
 * Query-string changes on the same page (tabs, pagination) are not blocked.
 */
export const UnsavedChangesGuard: React.FC<{ when: boolean }> = ({ when }) => {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
      title="Discard your changes?"
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      tone="danger"
    >
      You have edits that haven't been saved. Leaving this page will lose them.
    </ConfirmDialog>
  );
};
