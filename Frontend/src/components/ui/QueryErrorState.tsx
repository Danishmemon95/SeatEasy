import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorStatus, getRtkErrorMessage } from '../../api/errors';
import { Alert } from './Alert';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface QueryErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** What a 404 means here, e.g. "venue". */
  noun: string;
  /** Where the "not found" state links back to. */
  backTo: string;
  backLabel: string;
}

/**
 * Plan §7: a 404 on a detail page is an in-shell "not found" with a way back
 * (this also covers another organizer's ids). Anything else shows the message
 * with a Retry.
 */
export const QueryErrorState: React.FC<QueryErrorStateProps> = ({ error, onRetry, noun, backTo, backLabel }) => {
  const navigate = useNavigate();

  if (getErrorStatus(error) === 404) {
    return (
      <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px]">
        <EmptyState
          title={`This ${noun} doesn't exist`}
          description="It may have been deleted, or it belongs to another account."
          action={
            <Button variant="secondary" onClick={() => navigate(backTo)}>
              {backLabel}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <Alert variant="danger" title={`Couldn't load this ${noun}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <span>{getRtkErrorMessage(error)}</span>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </Alert>
  );
};
