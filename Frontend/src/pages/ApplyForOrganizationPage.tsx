import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import {
  useApplyForOrganizationMutation,
  useGetMyApplicationQuery,
} from '../api/applicationApi';
import { getRtkErrorMessage } from '../api/authApi';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Send,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const ApplyForOrganizationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: myAppData,
    isLoading: isAppLoading,
  } = useGetMyApplicationQuery();

  const [applyForOrg, { isLoading: isSubmitting }] = useApplyForOrganizationMutation();

  const application = myAppData?.application;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = description.trim();
    if (!trimmed) {
      setFormError('Please provide a description for your organization application.');
      return;
    }

    if (trimmed.length < 10) {
      setFormError('Description must be at least 10 characters long.');
      return;
    }

    try {
      await applyForOrg({ description: trimmed }).unwrap();
      setDescription('');
    } catch (err) {
      setFormError(getRtkErrorMessage(err));
    }
  };

  // State 0: User is an Admin (Admins review applications, they do not apply)
  if (user?.role === 'admin') {
    return (
      <AuthLayout>
        <Card className="w-full flex flex-col gap-6 shadow-sm border-[var(--rule)]">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--rule)]">
            <div className="w-10 h-10 rounded-full bg-[var(--warning-subtle)] text-[var(--warning)] flex items-center justify-center border border-[var(--warning)]/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">ADMINISTRATOR ACCESS</span>
              <h2 className="font-display font-medium text-xl text-[var(--ink)]">
                Admin Account
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Alert variant="info" title="No Application Needed">
              As a System Administrator, you already have full management privileges. Admins review and decide buyer organization applications rather than creating them.
            </Alert>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--rule)]">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => navigate('/admin/applications')}
              className="w-full"
            >
              Go to Admin Applications Portal
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/account')}
              className="w-full"
            >
              Back to Account
            </Button>
          </div>
        </Card>
      </AuthLayout>
    );
  }

  // State 1: User is already an organizer
  if (user?.role === 'organizer') {
    return (
      <AuthLayout>
        <Card className="w-full flex flex-col gap-6 shadow-sm border-[var(--rule)]">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--rule)]">
            <div className="w-10 h-10 rounded-full bg-[var(--success-subtle)] text-[var(--success)] flex items-center justify-center border border-[var(--success)]/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">ORGANIZATION STATUS</span>
              <h2 className="font-display font-medium text-xl text-[var(--ink)]">
                You're an Organizer!
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Alert variant="success" title="Application Approved">
              Your account has organizer privileges. You can now create and manage events, venues, and seat layouts.
            </Alert>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--rule)]">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => navigate('/organizer/dashboard')}
              className="w-full"
            >
              Go to Organizer Dashboard
            </Button>
          </div>
        </Card>
      </AuthLayout>
    );
  }

  // State 2: Loading application data
  if (isAppLoading) {
    return (
      <AuthLayout>
        <Card className="w-full flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <p className="text-sm text-[var(--ink-secondary)]">Loading application status...</p>
        </Card>
      </AuthLayout>
    );
  }

  // State 3: Existing Application found
  if (application) {
    const isPending = application.status === 'pending';
    const isApproved = application.status === 'approved';
    const isRejected = application.status === 'rejected';

    return (
      <AuthLayout>
        <Card className="w-full flex flex-col gap-6 shadow-sm border-[var(--rule)]">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--rule)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-caption text-[var(--ink-muted)] block">APPLICATION STATUS</span>
                <h2 className="font-display font-medium text-xl text-[var(--ink)]">
                  Organization Application
                </h2>
              </div>
            </div>
            {isPending && (
              <Badge variant="warning">
                <Clock className="w-3.5 h-3.5 mr-1" />
                PENDING
              </Badge>
            )}
            {isApproved && (
              <Badge variant="success">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                APPROVED
              </Badge>
            )}
            {isRejected && (
              <Badge variant="danger">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                REJECTED
              </Badge>
            )}
          </div>

          {isPending && (
            <Alert variant="warning" title="Under Review">
              Your application to become an event organizer has been submitted and is currently under review by our admin team.
            </Alert>
          )}

          {isApproved && (
            <Alert variant="success" title="Application Approved">
              Congratulations! Your organization application has been approved. You now have access to event organizer tools.
            </Alert>
          )}

          {isRejected && (
            <Alert variant="danger" title="Application Not Approved">
              Your organization application was reviewed and not approved at this time.
            </Alert>
          )}

          <div className="flex flex-col gap-3 p-4 rounded-[6px] bg-[var(--paper-sunken)] border border-[var(--rule)]">
            <span className="text-caption text-[var(--ink-muted)] block">YOUR SUBMITTED REASON / DESCRIPTION</span>
            <p className="text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed">
              {application.description}
            </p>
            <div className="pt-2 border-t border-[var(--rule)] flex justify-between text-xs text-[var(--ink-muted)]">
              <span>Submitted on</span>
              <span className="font-mono">
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

          {isApproved && (
            <div className="pt-2 border-t border-[var(--rule)]">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate('/organizer/dashboard')}
                className="w-full"
              >
                Go to Organizer Dashboard
              </Button>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--rule)]">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/account')}
              className="w-full"
            >
              Back to Account
            </Button>
          </div>
        </Card>
      </AuthLayout>
    );
  }

  // State 4: No application yet -> Application Form
  return (
    <AuthLayout>
      <Card className="w-full flex flex-col gap-6 shadow-sm border-[var(--rule)]">
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--rule)]">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-caption text-[var(--ink-muted)] block">BECOME AN ORGANIZER</span>
            <h2 className="font-display font-medium text-xl text-[var(--ink)]">
              Apply for Organization
            </h2>
          </div>
        </div>

        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
          Submit your application to become an Event Organizer on SeatEase. Tell us about your organization and the events you plan to host.
        </p>

        {formError && (
          <Alert variant="danger" onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="description"
              className="text-xs font-medium text-[var(--ink)] uppercase tracking-wider"
            >
              Organization Description & Purpose <span className="text-[var(--danger)]">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your organization, types of events you host, estimated audience size, and why you would like organizer access..."
              disabled={isSubmitting}
              className="w-full rounded-[6px] border border-[var(--rule)] bg-[var(--paper-raised)] p-3 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-2 focus:outline-[var(--accent)] focus:border-transparent transition-all"
            />
            <span className="text-caption text-[var(--ink-muted)] align-right self-end">
              {description.length} characters
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--rule)]">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<Send className="w-4 h-4" />}
              className="w-full"
            >
              Submit Application
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => navigate('/account')}
              disabled={isSubmitting}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </AuthLayout>
  );
};
