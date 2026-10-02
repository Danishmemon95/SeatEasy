import type React from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, Pencil, Trash2 } from 'lucide-react';
import {
  useCancelScreeningMutation,
  useDeleteScreeningMutation,
  useGetScreeningQuery,
} from '../../../api/catalog/screeningEndpoints';
import { useGetVenueSeatsQuery } from '../../../api/catalog/seatEndpoints';
import { getRtkErrorMessage } from '../../../api/errors';
import { useDocumentTitle } from '../../../app/useDocumentTitle';
import { useToast } from '../../../features/toast/useToast';
import { SEAT_CATEGORIES, type Screening } from '../../../types/catalog.types';
import { CATEGORY_LABELS, screeningDisplayStatus, screeningLockReason } from '../../../utils/catalogDisplay';
import { formatDate, formatDay, formatINR, formatTime } from '../../../utils/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { QueryErrorState } from '../../../components/ui/QueryErrorState';
import { SeatSwatch } from '../../../components/ui/SeatSwatch';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** AVAILABLE · HELD · BOOKED · TOTAL, plus one stacked bar in the seat map's state language. */
const Inventory: React.FC<{ seats: Screening['seats'] }> = ({ seats }) => {
  const pct = (n: number) => (seats.total > 0 ? (n / seats.total) * 100 : 0);
  const stats = [
    { label: 'AVAILABLE', value: seats.available },
    { label: 'HELD', value: seats.held },
    { label: 'BOOKED', value: seats.booked },
    { label: 'TOTAL', value: seats.total, strong: true },
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="inventory-heading">
      <h2 id="inventory-heading" className="text-caption text-[var(--ink-muted)]">
        INVENTORY
      </h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--rule)] border border-[var(--rule)] rounded-[10px] overflow-hidden">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 px-4 py-3 bg-[var(--paper-raised)]">
            <dt className="text-caption text-[var(--ink-muted)]">{s.label}</dt>
            <dd
              className={`text-[22px] leading-7 tabular-nums ${s.strong ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-secondary)]'}`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-[var(--paper-sunken)] border border-[var(--rule)]" aria-hidden="true">
          <div className="h-full bg-[var(--ink-secondary)]" style={{ width: `${pct(seats.booked)}%` }} />
          <div
            className="h-full"
            style={{
              width: `${pct(seats.held)}%`,
              backgroundImage: 'repeating-linear-gradient(135deg, var(--ink-muted) 0 2px, transparent 2px 5px)',
            }}
          />
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[var(--ink-muted)]">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-2 rounded-[2px] bg-[var(--ink-secondary)]" /> Booked
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-3 h-2 rounded-[2px] border border-[var(--rule)]"
              style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--ink-muted) 0 2px, transparent 2px 5px)' }}
            />{' '}
            Held
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-2 rounded-[2px] bg-[var(--paper-sunken)] border border-[var(--rule)]" /> Available
          </li>
        </ul>
      </div>
    </section>
  );
};

/**
 * Category, price and (for an upcoming screening) seats in that category. The
 * per-category count comes from the venue's layout, which is locked while the
 * screening is upcoming, so it matches the inventory exactly. For past or
 * cancelled screenings the layout may have changed since, so it's left out.
 */
const PriceTable: React.FC<{ screening: Screening; seatCounts?: Partial<Record<string, number>> }> = ({
  screening,
  seatCounts,
}) => {
  const priced = SEAT_CATEGORIES.filter((c) => screening.prices[c] !== undefined);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="prices-heading">
      <h2 id="prices-heading" className="text-caption text-[var(--ink-muted)]">
        PRICES
      </h2>
      <table className="w-full max-w-[480px] text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--rule)]">
            <th scope="col" className="text-caption text-[var(--ink-muted)] font-medium text-left py-2">
              Category
            </th>
            <th scope="col" className="text-caption text-[var(--ink-muted)] font-medium text-right py-2">
              Price
            </th>
            {seatCounts && (
              <th scope="col" className="text-caption text-[var(--ink-muted)] font-medium text-right py-2">
                Seats
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {priced.map((c) => (
            <tr key={c} className="border-b border-[var(--rule)]">
              <td className="py-3">
                <span className="flex items-center gap-2 text-[var(--ink)]">
                  <SeatSwatch category={c} />
                  {CATEGORY_LABELS[c]}
                </span>
              </td>
              <td className="py-3 text-right tabular-nums text-[var(--ink)]">{formatINR(screening.prices[c]!)}</td>
              {seatCounts && <td className="py-3 text-right tabular-nums text-[var(--ink-secondary)]">{seatCounts[c] ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const ScreeningDetailPage: React.FC = () => {
  const { screeningId: idParam } = useParams();
  const screeningId = Number(idParam);
  const validId = Number.isInteger(screeningId) && screeningId > 0;

  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useGetScreeningQuery(screeningId, { skip: !validId });
  const screening = data?.screening;
  useDocumentTitle(screening?.show ? `${screening.show.title} · ${formatDay(screening.startsAt)}` : 'Screening');

  const displayStatus = screening ? screeningDisplayStatus(screening) : null;
  const isUpcoming = displayStatus === 'scheduled';
  const seatsQuery = useGetVenueSeatsQuery(screening?.venueId ?? 0, { skip: !screening || !isUpcoming });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelScreening, { isLoading: isCancelling }] = useCancelScreeningMutation();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteScreening, { isLoading: isDeleting }] = useDeleteScreeningMutation();

  const notFound = !validId ? { status: 404 } : error;

  if (notFound) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
        <PageHeader
          eyebrow="SCREENING"
          title="Screening"
          breadcrumbs={[{ label: 'Events', to: '/organizer/events' }, { label: 'Screening' }]}
        />
        <QueryErrorState error={notFound} onRetry={refetch} noun="screening" backTo="/organizer/events" backLabel="Back to events" />
      </div>
    );
  }

  if (isLoading || !screening) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col gap-8" aria-busy="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full max-w-[480px]" />
      </div>
    );
  }

  const target = { screeningId: screening.id, showId: screening.showId, venueId: screening.venueId };
  const eventPath = `/organizer/events/${screening.showId}`;
  const showTitle = screening.show?.title ?? 'Event';
  const lockReason = screeningLockReason(screening);

  const handleCancel = async () => {
    setCancelError(null);
    try {
      await cancelScreening(target).unwrap();
      setCancelOpen(false);
      toast('Screening cancelled', 'success');
    } catch (err) {
      setCancelError(getRtkErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteScreening(target).unwrap();
      toast('Screening deleted', 'success');
      navigate(eventPath, { replace: true });
    } catch (err) {
      // e.g. 409 "Seats … are held or booked, so it can't be deleted; cancel it instead".
      setDeleteError(getRtkErrorMessage(err));
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
      <PageHeader
        eyebrow={showTitle.toUpperCase()}
        title={
          <span className="tabular-nums">
            {formatDay(screening.startsAt)} · {formatTime(screening.startsAt)}
          </span>
        }
        meta={displayStatus && <StatusBadge status={displayStatus} />}
        description={
          <span className="text-[var(--ink-muted)] tabular-nums">
            {screening.venue.name} · {screening.venue.city} · {formatTime(screening.startsAt)} – {formatTime(screening.endsAt)} IST
          </span>
        }
        breadcrumbs={[
          { label: 'Events', to: '/organizer/events' },
          { label: showTitle, to: eventPath },
          { label: 'Screening' },
        ]}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate(`/organizer/screenings/${screening.id}/edit`)}
              disabled={Boolean(lockReason)}
              title={lockReason ?? undefined}
              leftIcon={<Pencil className="w-4 h-4" />}
            >
              Edit
            </Button>
            {isUpcoming && (
              <Button variant="danger-ghost" onClick={() => setCancelOpen(true)} leftIcon={<Ban className="w-4 h-4" />}>
                Cancel screening
              </Button>
            )}
            <Button variant="danger-ghost" onClick={() => setDeleteOpen(true)} leftIcon={<Trash2 className="w-4 h-4" />}>
              Delete
            </Button>
          </>
        }
      />

      {/* The reason Edit is disabled, in words rather than a tooltip on a disabled button. */}
      {lockReason && <Alert variant="info">{lockReason}</Alert>}

      <Inventory seats={screening.seats} />
      <PriceTable screening={screening} seatCounts={isUpcoming ? seatsQuery.data?.summary : undefined} />

      <p className="text-[13px] text-[var(--ink-muted)] tabular-nums">
        Created {formatDate(screening.createdAt)}
        {screening.cancelledAt && ` · Cancelled ${formatDate(screening.cancelledAt)}`}
      </p>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setCancelError(null);
        }}
        onConfirm={handleCancel}
        title="Cancel this screening?"
        confirmLabel="Cancel screening"
        cancelLabel="Keep screening"
        tone="danger"
        isLoading={isCancelling}
        error={cancelError}
      >
        Buyers will no longer be able to book. Existing holds and bookings are kept for refunds. This can't be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete this screening?"
        confirmLabel="Delete screening"
        tone="danger"
        isLoading={isDeleting}
        error={deleteError}
      >
        This removes the screening and its seat inventory. It can't be undone. Once any seat is held or booked, cancel it
        instead.
      </ConfirmDialog>
    </div>
  );
};
