import type React from 'react';
import { PhasePlaceholder } from '../PhasePlaceholder';

export const VenueDetailPage: React.FC = () => (
  <PhasePlaceholder
    eyebrow="VENUE"
    title="Venue"
    phase="Phase 1: Venues (layout editor in Phase 2)"
    breadcrumbs={[{ label: 'Venues', to: '/organizer/venues' }, { label: 'Venue' }]}
  />
);
