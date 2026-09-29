import type React from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { useDeleteVenueMutation, useGetVenueQuery } from '../../../api/catalog/venueEndpoints';
import { getRtkErrorMessage } from '../../../api/errors';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useTabParam, type TabItem } from '../../../app/urlState';
import { useAuth } from '../../../features/auth/useAuth';
import { useToast } from '../../../features/toast/useToast';
import type { Venue } from '../../../types/catalog.types';
import { formatDate } from '../../../utils/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TabPanel, Tabs } from '../../../components/ui/Tabs';

type VenueTab = 'layout' | 'details';
const TABS: readonly TabItem<VenueTab>[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'details', label: 'Details' },
];

const DetailsTab: React.FC<{ venue: Venue; showOwner: boolean; onEdit: () => void }> = ({ venue, showOwner, onEdit }) => {
  const rows: Array<{ label: string; value: string; className?: string }> = [
    { label: 'Name', value: venue.name },
    { label: 'City', value: venue.city },
    { label: 'Address', value: venue.address },
    { label: 'Created', value: formatDate(venue.createdAt), className: 'tabular-nums' },
    { label: 'Last updated', value: formatDate(venue.updatedAt), className: 'tabular-nums' },
    ...(showOwner ? [{ label: 'Owner', value: `#${venue.ownerId}`, className: 'font-mono text-[13px]' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[680px]">
      <dl className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {rows.map(({ label, value, className = '' }) => (
          <div key={label} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4 py-3">
            <dt className="text-caption text-[var(--ink-muted)] sm:pt-0.5">{label}</dt>
            <dd className={`text-[15px] leading-6 text-[var(--ink)] break-words ${className}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <Button variant="secondary" onClick={onEdit} leftIcon={<Pencil className="w-4 h-4" />}>
          Edit details
        </Button>
      </div>
    </div>
  );
};

export const VenueDetailPage: React.FC = () => {
  const { venueId: venueIdParam } = useParams();
  const venueId = Number(venueIdParam);
  const validId = Number.isInteger(venueId) && venueId > 0;

  const navigate = useNavigate();
  const toast = useToast();
  const { hasRole } = useAuth();
  const [tab, setTab] = useTabParam(TABS);

  const { data, isLoading, error, refetch } = useGetVenueQuery(venueId, { skip: !validId });
  const venue = data?.venue;
  useDocumentTitle(venue?.name ?? 'Venue');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteVenue, { isLoading: isDeleting }] = useDeleteVenueMutation();

  const editPath = `/organizer/venues/${venueId}/edit`;

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteVenue(venueId).unwrap();
      toast('Venue deleted', 'success');
      navigate('/organizer/venues', { replace: true });
    } catch (err) {
      // e.g. 409 "This venue has screenings and cannot be deleted": shown in the open dialog.
      setDeleteError(getRtkErrorMessage(err));
    }
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteError(null);
  };

  const notFound = !validId ? { status: 404 } : error;

  if (notFound) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
        <PageHeader eyebrow="VENUE" title="Venue" breadcrumbs={[{ label: 'Venues', to: '/organizer/venues' }, { label: 'Venue' }]} />
        <QueryErrorState error={notFound} onRetry={refetch} noun="venue" backTo="/organizer/venues" backLabel="Back to venues" />
      </div>
    );
  }

  if (isLoading || !venue) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col gap-8" aria-busy="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow="VENUE"
        title={venue.name}
        description={
          <span className="text-[var(--ink-muted)]">
            {venue.city} · {venue.address}
          </span>
        }
        breadcrumbs={[{ label: 'Venues', to: '/organizer/venues' }, { label: venue.name }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(editPath)} leftIcon={<Pencil className="w-4 h-4" />}>
              Edit details
            </Button>
            <Button
              variant="danger-ghost"
              onClick={() => setDeleteOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete venue
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="venue" />

        {tab === 'layout' && (
          <TabPanel idPrefix="venue" id="layout">
            <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px]">
              <EmptyState
                title="Seat layout coming next"
                description="The layout editor (rows, seats and categories) arrives in Phase 2 of the plan."
              />
            </div>
          </TabPanel>
        )}

        {tab === 'details' && (
          <TabPanel idPrefix="venue" id="details">
            <DetailsTab venue={venue} showOwner={hasRole('admin')} onEdit={() => navigate(editPath)} />
          </TabPanel>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={`Delete ${venue.name}?`}
        confirmLabel="Delete venue"
        tone="danger"
        isLoading={isDeleting}
        error={deleteError}
      >
        This removes the venue and its seat layout. It can't be undone. A venue that has ever had a screening can't be
        deleted.
      </ConfirmDialog>
    </div>
  );
};
