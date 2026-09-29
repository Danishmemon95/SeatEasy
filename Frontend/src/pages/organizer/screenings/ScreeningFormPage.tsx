import type React from 'react';
import { useParams } from 'react-router-dom';
import { PhasePlaceholder } from '../PhasePlaceholder';

export const ScreeningFormPage: React.FC = () => {
  const { screeningId } = useParams();
  return (
    <PhasePlaceholder
      eyebrow="SCREENINGS"
      title={screeningId ? 'Edit screening' : 'Schedule screening'}
      phase="Phase 4: Screenings"
      breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: 'Screening' }]}
    />
  );
};
