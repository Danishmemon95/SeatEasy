import type React from 'react';
import { useState } from 'react';
import { useGetApplicationListQuery } from '../../api/applicationApi';
import type { ApplicationStatus } from '../../types/application.types';
import { ApplicationDetailPanel } from '../../components/application/ApplicationDetailPanel';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { getRtkErrorMessage } from '../../api/authApi';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
} from 'lucide-react';

export const AdminApplicationsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | ApplicationStatus>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useGetApplicationListQuery();

  const applications = data?.applications ?? [];

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const statusBadgeMap: Record<ApplicationStatus, React.ReactNode> = {
    pending: (
      <Badge variant="warning">
        <Clock className="w-3 h-3 mr-1" />
        PENDING
      </Badge>
    ),
    approved: (
      <Badge variant="success">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        APPROVED
      </Badge>
    ),
    rejected: (
      <Badge variant="danger">
        <XCircle className="w-3 h-3 mr-1" />
        REJECTED
      </Badge>
    ),
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--rule)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-caption text-[var(--ink-muted)] block">ADMINISTRATION</span>
            <h1 className="font-display font-medium text-xl text-[var(--ink)]">
              Organization Applications
            </h1>
          </div>
        </div>
      </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[var(--paper-sunken)] rounded-[8px] border border-[var(--rule)]">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => {
              const count =
                tab === 'all'
                  ? applications.length
                  : applications.filter((a) => a.status === tab).length;

              const isActive = filter === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium capitalize transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-[var(--paper-raised)] text-[var(--ink)] shadow-xs border border-[var(--rule)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>

          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Refresh List
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="danger" title="Failed to Load Applications">
            {getRtkErrorMessage(error)}
          </Alert>
        )}

        {/* Main Content / Table */}
        <Card className="p-0 overflow-hidden shadow-xs border-[var(--rule)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
              <span className="text-sm text-[var(--ink-secondary)]">Loading applications...</span>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center p-6">
              <div className="w-12 h-12 rounded-full bg-[var(--paper-sunken)] text-[var(--ink-muted)] flex items-center justify-center border border-[var(--rule)]">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--ink)]">No Applications Found</h3>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  {filter === 'all'
                    ? 'No organization applications have been submitted yet.'
                    : `No applications with status "${filter}".`}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--rule)]">
              {filteredApplications.map((app) => {
                const isExpanded = expandedId === app.id;

                return (
                  <div key={app.id} className="flex flex-col">
                    {/* Row Header */}
                    <div
                      onClick={() => toggleExpand(app.id)}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 gap-3 transition-colors cursor-pointer select-none hover:bg-[var(--paper-sunken)] ${
                        isExpanded ? 'bg-[var(--paper-sunken)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[var(--paper-sunken)] text-[var(--ink-secondary)] flex items-center justify-center border border-[var(--rule)] shrink-0 font-mono text-xs">
                          #{app.id}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-[var(--ink)]">
                              User #{app.requesterId}
                            </span>
                            {statusBadgeMap[app.status]}
                          </div>
                          <span className="text-xs text-[var(--ink-secondary)] truncate max-w-md mt-0.5">
                            {app.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                        <span className="text-caption text-[var(--ink-muted)]">
                          {new Date(app.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[var(--ink-muted)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="p-4 bg-[var(--paper-raised)] border-t border-[var(--rule)]">
                        <ApplicationDetailPanel application={app} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
    </div>
  );
};
