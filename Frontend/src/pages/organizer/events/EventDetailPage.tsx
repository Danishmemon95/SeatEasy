import type React from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Pencil, Send, Trash2 } from 'lucide-react';
import { useDeleteShowMutation, useGetShowQuery } from '../../../api/catalog/showEndpoints';
import { getRtkErrorMessage } from '../../../api/errors';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useTabParam, type TabItem } from '../../../app/urlState';
import { useAuth } from '../../../features/auth/useAuth';
import { useToast } from '../../../features/toast/useToast';
import { EventPublishDialog } from '../../../features/events/EventPublishDialog';
import { Poster } from '../../../features/events/Poster';
import { ShowScreeningsTab } from '../../../features/screenings/ShowScreeningsTab';
import type { ShowDetail } from '../../../types/catalog.types';
import { AGE_RATING_MEANINGS, SHOW_TYPE_LABELS } from '../../../utils/catalogDisplay';
import { formatDate, formatDuration } from '../../../utils/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { TabPanel, Tabs } from '../../../components/ui/Tabs';

type EventTab = 'screenings' | 'details';
const TABS: readonly TabItem<EventTab>[] = [
  { id: 'screenings', label: 'Screenings' },
  { id: 'details', label: 'Details' },
];

const DetailsTab: React.FC<{ show: ShowDetail; showOwner: boolean; onEdit: () => void }> = ({
  show,
  showOwner,
  onEdit,
}) => {
  const rows: Array<{ label: string; value: string; className?: string }> = [
    { label: 'Type', value: SHOW_TYPE_LABELS[show.type] },
    { label: 'Age rating', value: `${show.ageRating} · ${AGE_RATING_MEANINGS[show.ageRating]}` },
    { label: 'Language', value: show.language },
    { label: 'Genre', value: show.genre ?? '—' },
    { label: 'Duration', value: `${formatDuration(show.durationMinutes)} (${show.durationMinutes} min)`, className: 'tabular-nums' },
    { label: 'Status', value: show.status === 'published' ? 'Published' : 'Draft' },
    ...(show.publishedAt ? [{ label: 'Published', value: formatDate(show.publishedAt), className: 'tabular-nums' }] : []),
    { label: 'Created', value: formatDate(show.createdAt), className: 'tabular-nums' },
    { label: 'Last updated', value: formatDate(show.updatedAt), className: 'tabular-nums' },
    ...(showOwner ? [{ label: 'Owner', value: `#${show.orgId}`, className: 'font-mono text-[13px]' }] : []),
  ];

  return (
    <div className="flex flex-col gap-8 max-w-[680px]">
      <section className="flex flex-col gap-2">
        <h2 className="text-caption text-[var(--ink-muted)]">DESCRIPTION</h2>
        <p className="max-w-[65ch] text-[15px] leading-7 text-[var(--ink)] whitespace-pre-line break-words">
          {show.description}
        </p>
      </section>

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

export const EventDetailPage: React.FC = () => {
  const { showId: showIdParam } = useParams();
  const showId = Number(showIdParam);
  const validId = Number.isInteger(showId) && showId > 0;

  const navigate = useNavigate();
  const toast = useToast();
  const { hasRole } = useAuth();
  const [tab, setTab] = useTabParam(TABS);

  const { data, isLoading, error, refetch } = useGetShowQuery(showId, { skip: !validId });
  const show = data?.show;
  useDocumentTitle(show?.title ?? 'Event');

  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteShow, { isLoading: isDeleting }] = useDeleteShowMutation();

  const editPath = `/organizer/events/${showId}/edit`;
  const schedulePath = `/organizer/events/${showId}/screenings/new`;

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteShow(showId).unwrap();
      toast('Event deleted', 'success');
      navigate('/organizer/events', { replace: true });
    } catch (err) {
      // e.g. 409 "…has sold or held seats…; cancel its screenings instead": shown in the open dialog.
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
        <PageHeader eyebrow="EVENT" title="Event" breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: 'Event' }]} />
        <QueryErrorState error={notFound} onRetry={refetch} noun="event" backTo="/organizer/events" backLabel="Back to events" />
      </div>
    );
  }

  if (isLoading || !show) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col gap-8" aria-busy="true">
        <div className="flex items-end gap-5">
          <Skeleton className="w-[120px] aspect-[2/3]" />
          <div className="flex flex-col gap-3 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isDraft = show.status === 'draft';

  const scheduleButton = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} onClick={() => navigate(schedulePath)} leftIcon={<CalendarPlus className="w-4 h-4" />}>
      Schedule screening
    </Button>
  );

  const metaLine = [show.language, formatDuration(show.durationMinutes), show.genre].filter(Boolean).join(' · ');

  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow={`${SHOW_TYPE_LABELS[show.type].toUpperCase()} · ${show.ageRating}`}
        title={show.title}
        meta={<StatusBadge status={show.status} />}
        media={<Poster url={show.posterUrl} title={show.title} size="md" alt={`Poster for ${show.title}`} />}
        description={<span className="text-[var(--ink-muted)] tabular-nums">{metaLine}</span>}
        breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: show.title }]}
        actions={
          <>
            {isDraft ? (
              <Button onClick={() => setPublishOpen(true)} leftIcon={<Send className="w-4 h-4" />}>
                Publish
              </Button>
            ) : (
              scheduleButton('primary')
            )}
            <Button variant="secondary" onClick={() => navigate(editPath)} leftIcon={<Pencil className="w-4 h-4" />}>
              Edit
            </Button>
            <Button variant="danger-ghost" onClick={() => setDeleteOpen(true)} leftIcon={<Trash2 className="w-4 h-4" />}>
              Delete event
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="event" />

        {tab === 'screenings' && (
          <TabPanel idPrefix="event" id="screenings">
            {/* The header's primary is Publish on a draft, so scheduling here is secondary. */}
            <ShowScreeningsTab showId={show.id} scheduleAction={scheduleButton(isDraft ? 'secondary' : 'primary')} />
          </TabPanel>
        )}

        {tab === 'details' && (
          <TabPanel idPrefix="event" id="details">
            <DetailsTab show={show} showOwner={hasRole('admin')} onEdit={() => navigate(editPath)} />
          </TabPanel>
        )}
      </div>

      <EventPublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        show={show}
        onPublished={() => {
          setPublishOpen(false);
          toast('Event published', 'success');
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={`Delete ${show.title}?`}
        confirmLabel="Delete event"
        tone="danger"
        isLoading={isDeleting}
        error={deleteError}
      >
        This removes the event and all of its screenings. It can't be undone. Once any seat is held or booked, the event
        can't be deleted; cancel its screenings instead.
      </ConfirmDialog>
    </div>
  );
};
