import type React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useGetShowsQuery } from '../../../api/catalog/showEndpoints';
import { useAuth } from '../../../features/auth/useAuth';
import { Poster } from '../../../features/events/Poster';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useChoiceParam, usePageParam } from '../../../app/urlState';
import type { Show } from '../../../types/catalog.types';
import { SHOW_TYPE_LABELS } from '../../../utils/catalogDisplay';
import { formatDate, formatDuration } from '../../../utils/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterPills } from '../../../components/ui/FilterPills';
import { Pagination } from '../../../components/ui/Pagination';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'draft' | 'published';
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
] as const satisfies readonly { value: StatusFilter; label: string }[];

const emptyCopy: Record<StatusFilter, { title: string; organizer: string; admin: string }> = {
  all: {
    title: 'No events yet',
    organizer: 'Create your first event, then schedule screenings of it at your venues.',
    admin: 'No organizer has created an event yet.',
  },
  draft: {
    title: 'No drafts',
    organizer: 'Every event you created has been published.',
    admin: 'There are no draft events.',
  },
  published: {
    title: 'Nothing published yet',
    organizer: 'Publish a draft to make it visible to buyers.',
    admin: 'No event has been published yet.',
  },
};

export const EventListPage: React.FC = () => {
  useDocumentTitle('Events');
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  // Admins see every organizer's events but can't create one (the API 403s).
  const isAdmin = hasRole('admin');
  const [page, setPage] = usePageParam();
  const [status, setStatus] = useChoiceParam(
    'status',
    STATUS_FILTERS.map((f) => f.value),
  );

  const { data, isLoading, isFetching, error, refetch } = useGetShowsQuery({
    page,
    pageSize: PAGE_SIZE,
    ...(status === 'all' ? {} : { status }),
  });
  const shows = data?.shows ?? [];

  // A page past the end (e.g. the last event on it was deleted) falls back to the last real page.
  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (data && page > 1 && page > totalPages) setPage(Math.max(totalPages, 1));
  }, [data, page, totalPages, setPage]);

  const newEventButton = !isAdmin && (
    <Button onClick={() => navigate('/organizer/events/new')} leftIcon={<Plus className="w-4 h-4" />}>
      New event
    </Button>
  );

  const columns: DataTableColumn<Show>[] = [
    {
      key: 'title',
      header: 'Event',
      render: (s) => (
        <div className="flex items-center gap-3 py-2 min-w-0">
          <Poster url={s.posterUrl} title={s.title} size="sm" />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-medium text-[var(--ink)] truncate" title={s.title}>
              {s.title}
            </span>
            <span className="flex items-center gap-1.5">
              <Badge>{SHOW_TYPE_LABELS[s.type].toUpperCase()}</Badge>
              <Badge>{s.ageRating}</Badge>
            </span>
          </div>
        </div>
      ),
    },
    { key: 'language', header: 'Language', render: (s) => s.language },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      render: (s) => formatDuration(s.durationMinutes),
    },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'created',
      header: 'Created',
      render: (s) => <span className="tabular-nums">{formatDate(s.createdAt)}</span>,
      hideOnMobile: true,
    },
    ...(isAdmin
      ? [
          {
            key: 'owner',
            header: 'Owner',
            align: 'right' as const,
            render: (s: Show) => <span className="font-mono text-[13px]">#{s.orgId}</span>,
          },
        ]
      : []),
  ];

  const copy = emptyCopy[status];

  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
      <PageHeader eyebrow="EVENTS" title={isAdmin ? 'All events' : 'Your events'} actions={newEventButton} />

      <div className="flex flex-col gap-4">
        <FilterPills options={STATUS_FILTERS} value={status} onChange={setStatus} label="Filter events by status" />

        {error ? (
          <QueryErrorState
            error={error}
            onRetry={refetch}
            noun="event list"
            backTo="/organizer/dashboard"
            backLabel="Back to dashboard"
          />
        ) : (
          <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <DataTable
              columns={columns}
              rows={shows}
              getRowKey={(s) => s.id}
              getRowLabel={(s) => s.title}
              onRowClick={(s) => navigate(`/organizer/events/${s.id}`)}
              isLoading={isLoading}
              empty={
                <EmptyState
                  title={copy.title}
                  description={isAdmin ? copy.admin : copy.organizer}
                  action={(status === 'all' && newEventButton) || undefined}
                />
              }
            />
            {data && <Pagination pagination={data.pagination} onPageChange={setPage} noun="events" />}
          </div>
        )}
      </div>
    </div>
  );
};
