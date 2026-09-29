import type React from 'react';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDeleteSeatRowMutation, useGetVenueSeatsQuery } from '../../api/catalog/seatEndpoints';
import { getRtkErrorMessage } from '../../api/errors';
import { useToast } from '../toast/useToast';
import { SEAT_CATEGORIES, type Seat } from '../../types/catalog.types';
import { CATEGORY_LABELS } from '../../utils/catalogDisplay';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CategoryLegend } from '../../components/ui/SeatSwatch';
import { ConfirmDialog } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryErrorState } from '../../components/ui/QueryErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { UnsavedChangesGuard } from '../../components/ui/UnsavedChangesGuard';
import { AddSeatRowsPanel } from './AddSeatRowsPanel';
import { makeLine, previewRows, suggestLabel, type DraftRowLine } from './draftRows';
import { SeatLayoutMap } from './SeatLayoutMap';
import { RowPopover, SeatPopover } from './SeatPopover';

type OpenPopover = { kind: 'seat'; seat: Seat; anchor: HTMLElement } | { kind: 'row'; row: string; anchor: HTMLElement };

/**
 * The venue's Layout tab (plan §6.4): summary, lock banner, the seat map with
 * per-seat and per-row actions, and the add-rows panel with a live preview.
 */
export const VenueLayoutEditor: React.FC<{ venueId: number }> = ({ venueId }) => {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGetVenueSeatsQuery(venueId);
  const [deleteSeatRow, { isLoading: isDeletingRow }] = useDeleteSeatRowMutation();

  const [lines, setLines] = useState<DraftRowLine[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [popover, setPopover] = useState<OpenPopover | null>(null);
  const [rowToDelete, setRowToDelete] = useState<string | null>(null);
  const [rowDeleteError, setRowDeleteError] = useState<string | null>(null);

  const seats = useMemo(() => data?.seats ?? [], [data]);
  const existingLabels = useMemo(() => new Set(seats.map((s) => s.rowLabel)), [seats]);
  const rowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of seats) counts.set(s.rowLabel, (counts.get(s.rowLabel) ?? 0) + 1);
    return counts;
  }, [seats]);
  const draftRows = useMemo(() => previewRows(lines), [lines]);

  if (error) {
    return <QueryErrorState error={error} onRetry={refetch} noun="seat layout" backTo="/organizer/venues" backLabel="Back to venues" />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-5 w-80 max-w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { summary, layoutLocked } = data;
  const isEmpty = seats.length === 0;
  const showPanel = !layoutLocked && panelOpen;
  const hasDraft = lines.some((l) => l.row.trim() !== '');

  const openPanel = () => {
    if (lines.length === 0) setLines([makeLine(suggestLabel(existingLabels))]);
    setPanelOpen(true);
  };

  const confirmDeleteRow = (row: string) => {
    setPopover(null);
    setRowDeleteError(null);
    setRowToDelete(row);
  };

  const handleDeleteRow = async () => {
    if (!rowToDelete) return;
    try {
      const result = await deleteSeatRow({ venueId, row: rowToDelete }).unwrap();
      toast(result.message, 'success');
      setRowToDelete(null);
    } catch (err) {
      setRowDeleteError(getRtkErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <UnsavedChangesGuard when={hasDraft} />

      {/* Summary strip */}
      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <dt className="text-caption text-[var(--ink-muted)]">Total</dt>
          <dd className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">{summary.total}</dd>
        </div>
        {SEAT_CATEGORIES.map((c) => (
          <div key={c} className="flex items-baseline gap-2">
            <dt className="text-caption text-[var(--ink-muted)]">{CATEGORY_LABELS[c]}</dt>
            <dd className="text-[15px] tabular-nums text-[var(--ink-secondary)]">{summary[c]}</dd>
          </div>
        ))}
      </dl>

      {layoutLocked && (
        <Alert variant="info" title="Layout is read-only">
          This venue has upcoming screenings, so its layout can't change until they finish or are cancelled.
        </Alert>
      )}

      <div className={`grid gap-6 ${showPanel ? 'xl:grid-cols-[minmax(0,1fr)_26rem]' : ''}`}>
        <div className="flex flex-col gap-4 min-w-0">
          {isEmpty && draftRows.length === 0 ? (
            <div className="bg-[var(--paper-sunken)] border border-[var(--rule)] rounded-[10px]">
              <EmptyState
                title="No seats yet"
                description={
                  layoutLocked
                    ? 'This venue has no seats.'
                    : 'Describe the venue a row at a time. Row A is nearest the stage.'
                }
                action={
                  !layoutLocked && !showPanel ? (
                    <Button onClick={openPanel} leftIcon={<Plus className="w-4 h-4" />}>
                      Add rows
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <SeatLayoutMap
              seats={seats}
              draftRows={draftRows}
              interactive={!layoutLocked}
              activeSeatId={popover?.kind === 'seat' ? popover.seat.id : null}
              onSeatActivate={(seat, anchor) =>
                setPopover((p) => (p?.kind === 'seat' && p.seat.id === seat.id ? null : { kind: 'seat', seat, anchor }))
              }
              onRowActivate={(row, anchor) =>
                setPopover((p) => (p?.kind === 'row' && p.row === row ? null : { kind: 'row', row, anchor }))
              }
            />
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CategoryLegend counts={summary} />
            {!layoutLocked && !isEmpty && (
              <p className="text-[13px] text-[var(--ink-muted)]">
                Select a seat to change its category. Delete a seat to leave a gap, such as an aisle.
              </p>
            )}
          </div>

          {!layoutLocked && !showPanel && !isEmpty && (
            <div>
              <Button variant="secondary" onClick={openPanel} leftIcon={<Plus className="w-4 h-4" />}>
                Add rows
              </Button>
            </div>
          )}
        </div>

        {showPanel && (
          <AddSeatRowsPanel
            venueId={venueId}
            existingLabels={existingLabels}
            lines={lines}
            onLinesChange={setLines}
            onDone={() => setPanelOpen(false)}
          />
        )}
      </div>

      {!layoutLocked && popover?.kind === 'seat' && (
        <SeatPopover
          // A fresh popover per seat, so its inline confirm/error state doesn't carry over.
          key={popover.seat.id}
          venueId={venueId}
          seat={popover.seat}
          anchor={popover.anchor}
          rowSeatCount={rowCounts.get(popover.seat.rowLabel) ?? 0}
          onClose={() => setPopover(null)}
          onDeleteRow={confirmDeleteRow}
        />
      )}
      {!layoutLocked && popover?.kind === 'row' && (
        <RowPopover
          key={popover.row}
          rowLabel={popover.row}
          seatCount={rowCounts.get(popover.row) ?? 0}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
          onDeleteRow={confirmDeleteRow}
        />
      )}

      <ConfirmDialog
        open={rowToDelete !== null}
        onClose={() => setRowToDelete(null)}
        onConfirm={handleDeleteRow}
        title={`Delete row ${rowToDelete ?? ''}?`}
        confirmLabel={`Delete row ${rowToDelete ?? ''}`}
        tone="danger"
        isLoading={isDeletingRow}
        error={rowDeleteError}
      >
        All {rowCounts.get(rowToDelete ?? '') ?? 0} seats in row {rowToDelete} will be removed. Other rows keep their
        labels.
      </ConfirmDialog>
    </div>
  );
};
