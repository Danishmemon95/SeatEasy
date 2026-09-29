import type React from 'react';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { PageHeader, type Crumb } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';

export interface PhasePlaceholderProps {
  eyebrow: string;
  title: string;
  /** Which phase of the venues/events/screenings plan builds this page. */
  phase: string;
  breadcrumbs?: Crumb[];
}

/**
 * Temporary stand-in for the catalog pages while they are built phase by phase
 * (see docs/venues-events-screenings-plan.md §10). Delete once the last page lands.
 */
export const PhasePlaceholder: React.FC<PhasePlaceholderProps> = ({ eyebrow, title, phase, breadcrumbs }) => {
  useDocumentTitle(title);
  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
      <PageHeader eyebrow={eyebrow} title={title} breadcrumbs={breadcrumbs} />
      <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px]">
        <EmptyState title="Not built yet" description={`This page arrives in ${phase}.`} />
      </div>
    </div>
  );
};
