import type React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCreateShowMutation,
  useGetShowQuery,
  useUpdateShowMutation,
} from '../../../api/catalog/showEndpoints';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useToast } from '../../../features/toast/useToast';
import { EventForm } from '../../../features/events/EventForm';
import type { Show, ShowInput, ShowUpdate } from '../../../types/catalog.types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';

/** `/organizer/events/new` (create) and `/organizer/events/:showId/edit` (edit). */
export const EventFormPage: React.FC = () => {
  const { showId: showIdParam } = useParams();
  const isEdit = showIdParam !== undefined;
  const showId = Number(showIdParam);
  const validId = Number.isInteger(showId) && showId > 0;

  const navigate = useNavigate();
  const toast = useToast();
  const [createShow] = useCreateShowMutation();
  const [updateShow] = useUpdateShowMutation();

  // A malformed id is treated as a 404 without asking the server.
  const { data, isLoading, error, refetch } = useGetShowQuery(showId, { skip: !isEdit || !validId });
  const show = data?.show;
  // Same rule as the API: any scheduled screening (even a past one) fixes the duration.
  const durationLocked = Boolean(show?.screenings.some((s) => s.status === 'scheduled'));

  useDocumentTitle(isEdit ? (show ? `Edit ${show.title}` : 'Edit event') : 'New event');

  const detailPath = (id: number) => `/organizer/events/${id}`;

  const handleSubmit = async (values: ShowUpdate) => {
    if (isEdit) {
      return (await updateShow({ showId, changes: values }).unwrap()).show;
    }
    return (await createShow(values as ShowInput).unwrap()).show;
  };

  const handleSaved = (saved: Show) => {
    if (isEdit) {
      toast('Event details saved', 'success');
      navigate(`${detailPath(saved.id)}?tab=details`);
    } else {
      toast('Draft saved. Schedule a screening next.', 'success');
      navigate(detailPath(saved.id));
    }
  };

  const breadcrumbs = [
    { label: 'Events', to: '/organizer/events' },
    ...(isEdit && show ? [{ label: show.title, to: detailPath(show.id) }] : []),
    { label: isEdit ? 'Edit' : 'New event' },
  ];

  const notFound = isEdit && !validId ? { status: 404 } : error;

  return (
    <div className="max-w-[880px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow="EVENTS"
        title={isEdit ? 'Edit event' : 'New event'}
        description={
          isEdit ? undefined : 'Saved as a draft. Schedule screenings, then publish it when you are ready to sell.'
        }
        breadcrumbs={breadcrumbs}
      />

      {notFound ? (
        <QueryErrorState error={notFound} onRetry={refetch} noun="event" backTo="/organizer/events" backLabel="Back to events" />
      ) : isEdit && (isLoading || !show) ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-11" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
          <Skeleton className="h-11" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <EventForm
          // Remount when the loaded show changes, so the form starts from its values.
          key={show?.id ?? 'new'}
          show={show}
          durationLocked={durationLocked}
          submitLabel={isEdit ? 'Save changes' : 'Save draft'}
          onSubmit={handleSubmit}
          onSaved={handleSaved}
          onCancel={() => navigate(isEdit ? detailPath(showId) : '/organizer/events')}
        />
      )}
    </div>
  );
};
