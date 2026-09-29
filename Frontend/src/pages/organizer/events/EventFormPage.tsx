import type React from 'react';
import { useParams } from 'react-router-dom';
import { PhasePlaceholder } from '../PhasePlaceholder';

export const EventFormPage: React.FC = () => {
  const { showId } = useParams();
  return (
    <PhasePlaceholder
      eyebrow="EVENTS"
      title={showId ? 'Edit event' : 'New event'}
      phase="Phase 3: Events"
      breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: showId ? 'Edit' : 'New' }]}
    />
  );
};
