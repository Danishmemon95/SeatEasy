import type React from 'react';
import { useState } from 'react';
import type { OrgApplication } from '../../types/application.types';
import { useApplicationDecisionMutation } from '../../api/applicationApi';
import { getRtkErrorMessage } from '../../api/authApi';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { CheckCircle2, XCircle, User, Calendar, FileText } from 'lucide-react';

interface ApplicationDetailPanelProps {
  application: OrgApplication;
}

export const ApplicationDetailPanel: React.FC<ApplicationDetailPanelProps> = ({ application }) => {
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [makeDecision, { isLoading: isSubmitting }] = useApplicationDecisionMutation();

  const handleDecision = async (status: 'approved' | 'rejected') => {
    setDecisionError(null);
    try {
      await makeDecision({
        applicationId: application.id,
        status,
      }).unwrap();
    } catch (err) {
      setDecisionError(getRtkErrorMessage(err));
    }
  };

  return (
    <div className="p-4 rounded-[8px] bg-[var(--paper-sunken)] border border-[var(--rule)] flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--rule)]">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--ink-muted)]" />
          <span className="font-mono text-xs font-semibold text-[var(--ink)]">
            Applicant: User #{application.requesterId}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            Submitted:{' '}
            {new Date(application.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider">
          <FileText className="w-3.5 h-3.5" />
          <span>Application Description</span>
        </div>
        <p className="p-3 rounded-[6px] bg-[var(--paper-raised)] border border-[var(--rule)] text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed">
          {application.description}
        </p>
      </div>

      {application.status !== 'pending' && (
        <div className="grid grid-cols-2 gap-3 p-3 rounded-[6px] bg-[var(--paper-raised)] border border-[var(--rule)] text-xs text-[var(--ink-muted)]">
          <div>
            <span className="block font-medium text-[var(--ink)]">Reviewed By</span>
            <span className="font-mono">User #{application.reviewerId ?? 'N/A'}</span>
          </div>
          <div>
            <span className="block font-medium text-[var(--ink)]">Reviewed At</span>
            <span>
              {application.reviewedAt
                ? new Date(application.reviewedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {decisionError && (
        <Alert variant="danger" onClose={() => setDecisionError(null)}>
          {decisionError}
        </Alert>
      )}

      {application.status === 'pending' && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--rule)]">
          <Button
            variant="danger"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={<XCircle className="w-4 h-4" />}
            onClick={() => handleDecision('rejected')}
          >
            Reject Application
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            onClick={() => handleDecision('approved')}
          >
            Approve & Promote
          </Button>
        </div>
      )}
    </div>
  );
};
