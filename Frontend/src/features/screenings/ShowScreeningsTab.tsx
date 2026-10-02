import type React from 'react';
import { useEffect } from 'react';
import { useGetShowScreeningsQuery } from '../../api/catalog/screeningEndpoints';
import { useChoiceParam, usePageParam } from '../../app/urlState';
import type { ScreeningListQuery } from '../../types/catalog.types';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterPills } from '../../components/ui/FilterPills';
import { Pagination } from '../../components/ui/Pagination';
import { QueryErrorState } from '../../components/ui/QueryErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { ScreeningDateGroup } from './ScreeningDateGroup';
import { groupByDay } from './groupByDay';

const PAGE_SIZE = 20;

type WhenFilter = 'upcoming' | 'past' | 'cancelled' | 'all';
const FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
] as const satisfies readonly { value: WhenFilter; label: string }[];

/** Each tab as a server filter, so pagination stays correct (backend §9-C). */
const filterQuery: Record<WhenFilter, ScreeningListQuery> = {
  upcoming: { status: 'scheduled', when: 'upcoming' },
  past: { status: 'scheduled', when: 'past' },
  cancelled: { status: 'cancelled' },
  all: {},
};

const emptyCopy: Record<WhenFilter, { title: string; description: string }> = {
  upcoming: { title: 'Nothing coming up', description: 'Pick a venue, a time and prices for each seat category.' },
  past: { title: 'No past screenings', description: 'Screenings move here once they start.' },
  cancelled: { title: 'Nothing cancelled', description: 'Cancelled screenings are kept here for the record.' },
  all: { title: 'No screenings yet', description: 'Pick a venue, a time and prices for each seat category.' },
};

export interface ShowScreeningsTabProps {
  showId: number;
  /** The Schedule screening button; offered where scheduling is the next step. */
  scheduleAction: React.ReactNode;
}

/** The event detail's Screenings tab (plan §6.7): filtered, paginated, grouped by IST day. */
export const ShowScreeningsTab: React.FC<ShowScreeningsTabProps> = ({ showId, scheduleAction }) => {
  const [filter, setFilter] = useChoiceParam(
    'screenings',
    FILTERS.map((f) => f.value),
  );
  const [page, setPage] = usePageParam();

  const { data, isLoading, isFetching, error, refetch } = useGetShowScreeningsQuery({
    showId,
    page,
    pageSize: PAGE_SIZE,
    ...filterQuery[filter],
  });
  const screenings = data?.screenings ?? [];

  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (data && page > 1 && page > totalPages) setPage(Math.max(totalPages, 1));
  }, [data, page, totalPages, setPage]);

  const copy = emptyCopy[filter];
  const offerSchedule = filter === 'upcoming' || filter === 'all';
  // The empty state carries the button itself; don't show it twice.
  const emptyWithAction = !isLoading && !error && screenings.length === 0 && offerSchedule;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterPills options={FILTERS} value={filter} onChange={setFilter} label="Filter screenings" />
        {!emptyWithAction && scheduleAction}
      </div>

      {error ? (
        <QueryErrorState error={error} onRetry={refetch} noun="event" backTo="/organizer/events" backLabel="Back to events" />
      ) : isLoading ? (
        <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px] p-4 flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : screenings.length === 0 ? (
        <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px]">
          <EmptyState title={copy.title} description={copy.description} action={offerSchedule ? scheduleAction : undefined} />
        </div>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Not overflow-hidden: that would stop the date headers from sticking. */}
          <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px]">
            {groupByDay(screenings).map((day) => (
              <ScreeningDateGroup key={day.key} day={day} />
            ))}
          </div>
          {data && <Pagination pagination={data.pagination} onPageChange={setPage} noun="screenings" />}
        </div>
      )}

      <p className="text-[13px] text-[var(--ink-muted)]">All times are India Standard Time.</p>
    </div>
  );
};
