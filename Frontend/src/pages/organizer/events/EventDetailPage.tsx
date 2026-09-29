import type React from 'react';
import { PhasePlaceholder } from '../PhasePlaceholder';

export const EventDetailPage: React.FC = () => (
  <PhasePlaceholder
    eyebrow="EVENT"
    title="Event"
    phase="Phase 3: Events (screenings tab in Phase 4)"
    breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: 'Event' }]}
  />
);
