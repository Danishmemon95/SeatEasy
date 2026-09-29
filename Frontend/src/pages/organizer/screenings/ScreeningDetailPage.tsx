import type React from 'react';
import { PhasePlaceholder } from '../PhasePlaceholder';

export const ScreeningDetailPage: React.FC = () => (
  <PhasePlaceholder
    eyebrow="SCREENING"
    title="Screening"
    phase="Phase 4: Screenings"
    breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: 'Screening' }]}
  />
);
