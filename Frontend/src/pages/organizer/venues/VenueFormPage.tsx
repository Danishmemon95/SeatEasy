import type React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCreateVenueMutation,
  useGetVenueQuery,
  useUpdateVenueMutation,
} from '../../../api/catalog/venueEndpoints';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useToast } from '../../../features/toast/useToast';
import { VenueForm } from '../../../features/venues/VenueForm';
import type { VenueInput } from '../../../types/catalog.types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';

/** `/organizer/venues/new` (create) and `/organizer/venues/:venueId/edit` (edit). */
export const VenueFormPage: React.FC = () => {
  const { venueId: venueIdParam } = useParams();
  const isEdit = venueIdParam !== undefined;
  const venueId = Number(venueIdParam);
  const validId = Number.isInteger(venueId) && venueId > 0;

  const navigate = useNavigate();
  const toast = useToast();
  const [createVenue] = useCreateVenueMutation();
  const [updateVenue] = useUpdateVenueMutation();

  // A malformed id is treated as a 404 without asking the server.
  const { data, isLoading, error, refetch } = useGetVenueQuery(venueId, { skip: !isEdit || !validId });
  const venue = data?.venue;

  useDocumentTitle(isEdit ? (venue ? `Edit ${venue.name}` : 'Edit venue') : 'New venue');

  const detailPath = (id: number) => `/organizer/venues/${id}`;

  const handleSubmit = async (values: Partial<VenueInput>) => {
    if (isEdit) {
      return (await updateVenue({ venueId, changes: values }).unwrap()).venue;
    }
    return (await createVenue(values as VenueInput).unwrap()).venue;
  };

  const handleSaved = (saved: { id: number }) => {
    if (isEdit) {
      toast('Venue details saved', 'success');
      navigate(`${detailPath(saved.id)}?tab=details`);
    } else {
      // Straight into the next decision: the layout tab is the detail page's default.
      toast('Venue created. Add its seat rows.', 'success');
      navigate(detailPath(saved.id));
    }
  };

  const breadcrumbs = [
    { label: 'Venues', to: '/organizer/venues' },
    ...(isEdit && venue ? [{ label: venue.name, to: detailPath(venue.id) }] : []),
    { label: isEdit ? 'Edit' : 'New venue' },
  ];

  const notFound = isEdit && !validId ? { status: 404 } : error;

  return (
    <div className="max-w-[880px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow="VENUES"
        title={isEdit ? 'Edit venue' : 'New venue'}
        description={isEdit ? undefined : 'Where you run events. You can describe its seat layout after saving.'}
        breadcrumbs={breadcrumbs}
      />

      {notFound ? (
        <QueryErrorState error={notFound} onRetry={refetch} noun="venue" backTo="/organizer/venues" backLabel="Back to venues" />
      ) : isEdit && (isLoading || !venue) ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <VenueForm
          // Remount when the loaded venue changes, so the form starts from its values.
          key={venue?.id ?? 'new'}
          venue={venue}
          submitLabel={isEdit ? 'Save changes' : 'Create venue'}
          onSubmit={handleSubmit}
          onSaved={handleSaved}
          onCancel={() => navigate(isEdit ? detailPath(venueId) : '/organizer/venues')}
        />
      )}
    </div>
  );
};
