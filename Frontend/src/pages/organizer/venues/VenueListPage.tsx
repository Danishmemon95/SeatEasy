import type React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useGetVenuesQuery } from '../../../api/catalog/venueEndpoints';
import { useAuth } from '../../../features/auth/useAuth';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { usePageParam } from '../../../app/urlState';
import type { VenueListItem } from '../../../types/catalog.types';
import { formatDate } from '../../../utils/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';

const PAGE_SIZE = 20;

export const VenueListPage: React.FC = () => {
  useDocumentTitle('Venues');
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  // Admins see every organizer's venues but can't create one (the API 403s).
  const isAdmin = hasRole('admin');
  const [page, setPage] = usePageParam();

  const { data, isLoading, isFetching, error, refetch } = useGetVenuesQuery({ page, pageSize: PAGE_SIZE });
  const venues = data?.venues ?? [];

  // A page past the end (e.g. the last venue on it was deleted) falls back to the last real page.
  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (data && page > 1 && page > totalPages) setPage(Math.max(totalPages, 1));
  }, [data, page, totalPages, setPage]);

  const newVenueButton = !isAdmin && (
    <Button onClick={() => navigate('/organizer/venues/new')} leftIcon={<Plus className="w-4 h-4" />}>
      New venue
    </Button>
  );

  const columns: DataTableColumn<VenueListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (v) => <span className="font-medium text-[var(--ink)]">{v.name}</span>,
    },
    { key: 'city', header: 'City', render: (v) => v.city },
    {
      key: 'address',
      header: 'Address',
      render: (v) => (
        <span className="block truncate max-w-[18rem]" title={v.address}>
          {v.address}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'seats',
      header: 'Seats',
      align: 'right',
      render: (v) => (v.seatCount > 0 ? v.seatCount : <span className="text-[var(--ink-muted)]">No layout</span>),
    },
    { key: 'created', header: 'Created', render: (v) => <span className="tabular-nums">{formatDate(v.createdAt)}</span> },
    ...(isAdmin
      ? [
          {
            key: 'owner',
            header: 'Owner',
            align: 'right' as const,
            render: (v: VenueListItem) => <span className="font-mono text-[13px]">#{v.ownerId}</span>,
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
      <PageHeader eyebrow="VENUES" title={isAdmin ? 'All venues' : 'Your venues'} actions={newVenueButton} />

      {error ? (
        <QueryErrorState error={error} onRetry={refetch} noun="venue list" backTo="/organizer/dashboard" backLabel="Back to dashboard" />
      ) : (
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <DataTable
            columns={columns}
            rows={venues}
            getRowKey={(v) => v.id}
            getRowLabel={(v) => v.name}
            onRowClick={(v) => navigate(`/organizer/venues/${v.id}`)}
            isLoading={isLoading}
            empty={
              <EmptyState
                title="No venues yet"
                description={
                  isAdmin
                    ? 'No organizer has added a venue yet.'
                    : "Add the places you run events. You'll draw each one's seat layout next."
                }
                action={newVenueButton || undefined}
              />
            }
          />
          {data && <Pagination pagination={data.pagination} onPageChange={setPage} noun="venues" />}
        </div>
      )}
    </div>
  );
};
