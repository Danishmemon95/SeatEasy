import type React from 'react';
import { useParams } from 'react-router-dom';
import { PhasePlaceholder } from '../PhasePlaceholder';

export const VenueFormPage: React.FC = () => {
  const { venueId } = useParams();
  return (
    <PhasePlaceholder
      eyebrow="VENUES"
      title={venueId ? 'Edit venue' : 'New venue'}
      phase="Phase 1: Venues"
      breadcrumbs={[{ label: 'Venues', to: '/organizer/venues' }, { label: venueId ? 'Edit' : 'New' }]}
    />
  );
};
