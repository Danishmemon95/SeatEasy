import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useGetVenuesQuery } from '../../api/catalog/venueEndpoints';
import { useGetShowsQuery } from '../../api/catalog/showEndpoints';
import { useGetShowScreeningsQuery } from '../../api/catalog/screeningEndpoints';
import { getRtkErrorMessage } from '../../api/errors';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { useAuth } from '../../features/auth/useAuth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';

/** The most venues fetched to check for a seat layout; one page at the API's maximum. */
const VENUE_SAMPLE = 100;

interface Tile {
  label: string;
  value: number;
  detail: string;
  to: string;
  linkLabel: string;
}

const StatTile: React.FC<{ tile: Tile }> = ({ tile }) => (
  <Link
    to={tile.to}
    className="group flex flex-col gap-2 p-6 rounded-[16px] bg-[var(--paper-raised)] border border-[var(--rule)] transition-[border-color,box-shadow] duration-[150ms] hover:border-[var(--rule-strong)] hover:shadow-[var(--elev-1)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
  >
    <span className="text-caption text-[var(--ink-muted)]">{tile.label}</span>
    <span className="font-display text-[40px] leading-[44px] tabular-nums text-[var(--ink)]">{tile.value}</span>
    <span className="text-[13px] text-[var(--ink-secondary)] tabular-nums">{tile.detail}</span>
    <span className="mt-2 inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] group-hover:text-[var(--ink)]">
      {tile.linkLabel}
      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
    </span>
  </Link>
);

interface Step {
  label: string;
  done: boolean;
  to: string;
}

/**
 * Plan §6.1: the path from an empty account to a sellable event. Each step
 * links to where it's done; the first unfinished one is the page's single
 * primary action (§1.3).
 */
const NextSteps: React.FC<{ steps: Step[] }> = ({ steps }) => {
  const navigate = useNavigate();
  const current = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section
      aria-labelledby="next-steps-heading"
      className="flex flex-col gap-4 p-6 rounded-[16px] bg-[var(--paper-raised)] border border-[var(--rule)]"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="next-steps-heading" className="text-caption text-[var(--ink-muted)]">
          NEXT STEPS
        </h2>
        <span className="text-[13px] tabular-nums text-[var(--ink-muted)]">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <ol className="flex flex-col divide-y divide-[var(--rule)]">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <li key={step.label} className="flex items-center gap-3 py-3 min-h-14">
              <span
                aria-hidden="true"
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[12px] tabular-nums shrink-0 ${
                  step.done
                    ? 'bg-[var(--success-subtle)] border-[var(--success)]/30 text-[var(--success)]'
                    : isCurrent
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-[var(--rule-strong)] text-[var(--ink-muted)]'
                }`}
              >
                {step.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className="sr-only">{step.done ? 'Done: ' : isCurrent ? 'Next: ' : 'To do: '}</span>
              {isCurrent ? (
                <>
                  <span className="flex-1 min-w-0 text-[15px] font-medium text-[var(--ink)]">{step.label}</span>
                  <Button size="sm" onClick={() => navigate(step.to)} rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Start
                  </Button>
                </>
              ) : (
                <Link
                  to={step.to}
                  className={`flex-1 min-w-0 text-[15px] link-underline ${
                    step.done ? 'text-[var(--ink-muted)] line-through decoration-[var(--rule-strong)]' : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  {step.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export const OrganizerDashboardPage: React.FC = () => {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  // Newest first, so the first show is the one an organizer is likely setting up.
  const venuesQ = useGetVenuesQuery({ pageSize: VENUE_SAMPLE });
  const showsQ = useGetShowsQuery({ pageSize: 1 });
  const draftsQ = useGetShowsQuery({ pageSize: 1, status: 'draft' });
  const newest = showsQ.data?.shows[0];
  const newestScreeningsQ = useGetShowScreeningsQuery(
    { showId: newest?.id ?? 0, pageSize: 1, status: 'scheduled' },
    { skip: !newest || isAdmin },
  );

  const queries = [venuesQ, showsQ, draftsQ, ...(newest && !isAdmin ? [newestScreeningsQ] : [])];
  const error = queries.find((q) => q.error)?.error;
  const isLoading = queries.some((q) => q.isLoading) || !venuesQ.data || !showsQ.data || !draftsQ.data;

  const retry = () => {
    for (const q of queries) if (q.error) q.refetch();
  };

  let body: React.ReactNode;
  if (error) {
    body = (
      <Alert variant="danger">
        {getRtkErrorMessage(error)}{' '}
        <button type="button" onClick={retry} className="underline cursor-pointer">
          Retry
        </button>
      </Alert>
    );
  } else if (isLoading) {
    body = (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-[172px] rounded-[16px]" />
          <Skeleton className="h-[172px] rounded-[16px]" />
        </div>
        {!isAdmin && <Skeleton className="h-[340px] rounded-[16px]" />}
      </div>
    );
  } else {
    const venues = venuesQ.data!.venues;
    const venueTotal = venuesQ.data!.pagination.total;
    const withLayout = venues.filter((v) => v.seatCount > 0).length;
    const showTotal = showsQ.data!.pagination.total;
    const drafts = draftsQ.data!.pagination.total;
    const published = showTotal - drafts;

    const tiles: Tile[] = [
      {
        label: 'EVENTS',
        value: showTotal,
        detail: showTotal === 0 ? 'None yet' : `${drafts} draft${drafts === 1 ? '' : 's'} · ${published} published`,
        to: '/organizer/events',
        linkLabel: 'View events',
      },
      {
        label: 'VENUES',
        value: venueTotal,
        detail:
          venueTotal === 0
            ? 'None yet'
            : venueTotal > venues.length
              ? `${venueTotal} venues`
              : `${withLayout} with a seat layout`,
        to: '/organizer/venues',
        linkLabel: 'View venues',
      },
    ];

    const venueWithoutLayout = venues.find((v) => v.seatCount === 0);
    const newestHasScreening = (newestScreeningsQ.data?.pagination.total ?? 0) > 0;
    const steps: Step[] = [
      { label: 'Add a venue', done: venueTotal > 0, to: '/organizer/venues/new' },
      {
        label: 'Build its seat layout',
        done: withLayout > 0,
        to: venueWithoutLayout ? `/organizer/venues/${venueWithoutLayout.id}` : '/organizer/venues',
      },
      { label: 'Create an event', done: showTotal > 0, to: '/organizer/events/new' },
      {
        label: newest ? `Schedule a screening of ${newest.title}` : 'Schedule a screening',
        done: newestHasScreening,
        to: newest ? `/organizer/events/${newest.id}/screenings/new` : '/organizer/events',
      },
      {
        label: newest ? `Publish ${newest.title}` : 'Publish it',
        done: newest?.status === 'published',
        to: newest ? `/organizer/events/${newest.id}` : '/organizer/events',
      },
    ];
    const allDone = steps.every((s) => s.done);

    body = (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiles.map((t) => (
            <StatTile key={t.label} tile={t} />
          ))}
        </div>
        {/* Admins don't build venues or events, so the checklist isn't theirs. */}
        {!isAdmin && !allDone && <NextSteps steps={steps} />}
      </div>
    );
  }

  return (
    <div className="max-w-[1080px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow="DASHBOARD"
        title={`Welcome, ${user?.username ?? 'Organizer'}`}
        description={isAdmin ? "Every organizer's events and venues." : undefined}
        actions={
          !isAdmin && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/apply-for-organization')}>
              View application
            </Button>
          )
        }
      />
      {body}
    </div>
  );
};
