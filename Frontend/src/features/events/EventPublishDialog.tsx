import type React from 'react';
import { useState } from 'react';
import { usePublishShowMutation } from '../../api/catalog/showEndpoints';
import { getRtkErrorMessage } from '../../api/errors';
import type { ShowDetail } from '../../types/catalog.types';
import { screeningDisplayStatus } from '../../utils/catalogDisplay';
import { ConfirmDialog } from '../../components/ui/Modal';

export interface EventPublishDialogProps {
  open: boolean;
  onClose: () => void;
  show: ShowDetail;
  onPublished: () => void;
}

/**
 * Publishing is one-way (there is no unpublish endpoint), so it is confirmed
 * in an accent-toned dialog. It isn't blocked without screenings, since the
 * API allows it, but the dialog says so.
 */
export const EventPublishDialog: React.FC<EventPublishDialogProps> = ({ open, onClose, show, onPublished }) => {
  const [publishShow, { isLoading }] = usePublishShowMutation();
  const [error, setError] = useState<string | null>(null);

  // `scheduled` (not cancelled, not yet started) is what a buyer could book.
  const hasUpcoming = show.screenings.some((s) => screeningDisplayStatus(s) === 'scheduled');

  const close = () => {
    setError(null);
    onClose();
  };

  const handlePublish = async () => {
    setError(null);
    try {
      await publishShow(show.id).unwrap();
      onPublished();
    } catch (err) {
      // e.g. 409 "Show is already published": the show is refetched behind the dialog.
      setError(getRtkErrorMessage(err));
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={close}
      onConfirm={handlePublish}
      title={`Publish ${show.title}?`}
      confirmLabel="Publish event"
      tone="accent"
      isLoading={isLoading}
      error={error}
    >
      <div className="flex flex-col gap-2">
        <p>Publishing makes this event visible to buyers. It can't be unpublished.</p>
        {!hasUpcoming && (
          <p className="text-[var(--ink-muted)]">
            It has no upcoming screenings yet, so buyers won't have anything to book until you schedule one.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
};
