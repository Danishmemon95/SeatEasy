import type React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGetShowQuery } from '../../../api/catalog/showEndpoints';
import {
  useCreateScreeningMutation,
  useGetScreeningQuery,
  useUpdateScreeningMutation,
} from '../../../api/catalog/screeningEndpoints';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useAuth } from '../../../features/auth/useAuth';
import { useToast } from '../../../features/toast/useToast';
import { ScreeningForm } from '../../../features/screenings/ScreeningForm';
import type { Screening, ScreeningInput, ScreeningUpdate } from '../../../types/catalog.types';
import { screeningLockReason } from '../../../utils/catalogDisplay';
import { formatShowtime } from '../../../utils/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';

const positiveId = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * `/organizer/events/:showId/screenings/new` (schedule) and
 * `/organizer/screenings/:screeningId/edit` (edit).
 */
export const ScreeningFormPage: React.FC = () => {
  const params = useParams();
  const isEdit = params.screeningId !== undefined;
  const screeningId = positiveId(params.screeningId);

  const navigate = useNavigate();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [createScreening] = useCreateScreeningMutation();
  const [updateScreening] = useUpdateScreeningMutation();

  // Edit: the screening first, then its show (for the organizer id and title).
  const screeningQuery = useGetScreeningQuery(screeningId ?? 0, { skip: !isEdit || screeningId === null });
  const screening = screeningQuery.data?.screening;

  const showId = isEdit ? (screening?.showId ?? null) : positiveId(params.showId);
  const showQuery = useGetShowQuery(showId ?? 0, { skip: showId === null });
  const show = showQuery.data?.show;

  useDocumentTitle(isEdit ? 'Edit screening' : show ? `Schedule ${show.title}` : 'Schedule screening');

  const eventPath = (id: number) => `/organizer/events/${id}`;
  const detailPath = (id: number) => `/organizer/screenings/${id}`;

  const handleSubmit = async (values: ScreeningUpdate) => {
    if (isEdit && screening) {
      return (
        await updateScreening({
          screeningId: screening.id,
          showId: screening.showId,
          venueId: screening.venueId,
          changes: values,
        }).unwrap()
      ).screening;
    }
    return (await createScreening({ showId: showId!, body: values as ScreeningInput }).unwrap()).screening;
  };

  const handleSaved = (saved: Screening) => {
    toast(isEdit ? 'Screening updated' : 'Screening scheduled', 'success');
    navigate(detailPath(saved.id));
  };

  const breadcrumbs = [
    { label: 'Events', to: '/organizer/events' },
    ...(show ? [{ label: show.title, to: eventPath(show.id) }] : []),
    ...(isEdit && screening ? [{ label: 'Screening', to: detailPath(screening.id) }] : []),
    { label: isEdit ? 'Edit' : 'Schedule screening' },
  ];

  // A malformed id is a 404 without asking the server.
  const badId = isEdit ? screeningId === null : showId === null;
  const error = badId ? { status: 404 } : (screeningQuery.error ?? showQuery.error);
  const isLoading = !show || (isEdit && !screening);

  const lockReason = screening ? screeningLockReason(screening) : null;

  let body: React.ReactNode;
  if (error) {
    const noun = isEdit && (badId || screeningQuery.error) ? 'screening' : 'event';
    body = (
      <QueryErrorState
        error={error}
        onRetry={() => (screeningQuery.error ? screeningQuery.refetch() : showQuery.refetch())}
        noun={noun}
        backTo="/organizer/events"
        backLabel="Back to events"
      />
    );
  } else if (isLoading) {
    body = (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-[76px]" />
          <Skeleton className="h-[76px]" />
          <Skeleton className="h-[76px]" />
        </div>
        <Skeleton className="h-11 max-w-[480px]" />
      </div>
    );
  } else if (screening && lockReason) {
    body = (
      <div className="flex flex-col items-start gap-4">
        <Alert variant="info">{lockReason}</Alert>
        <Button variant="secondary" onClick={() => navigate(detailPath(screening.id))} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to screening
        </Button>
      </div>
    );
  } else {
    body = (
      <ScreeningForm
        key={screening?.id ?? 'new'}
        show={show!}
        screening={screening}
        isAdmin={isAdmin}
        submitLabel={isEdit ? 'Save changes' : 'Schedule screening'}
        onSubmit={handleSubmit}
        onSaved={handleSaved}
        onCancel={() => navigate(screening ? detailPath(screening.id) : eventPath(show!.id))}
      />
    );
  }

  return (
    <div className="max-w-[1080px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow={show ? show.title.toUpperCase() : 'SCREENINGS'}
        title={isEdit ? 'Edit screening' : 'Schedule screening'}
        description={
          isEdit && screening
            ? `Currently ${formatShowtime(screening.startsAt)} at ${screening.venue.name}.`
            : 'Pick a venue, a time, and a price for each seat category.'
        }
        breadcrumbs={breadcrumbs}
      />
      {body}
    </div>
  );
};
