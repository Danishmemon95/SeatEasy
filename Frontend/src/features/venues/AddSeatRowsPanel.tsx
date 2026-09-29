import type React from 'react';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAddSeatRowsMutation } from '../../api/catalog/seatEndpoints';
import { getRtkErrorMessage } from '../../api/errors';
import { useToast } from '../toast/useToast';
import { SEAT_CATEGORIES, type SeatCategory } from '../../types/catalog.types';
import { CATEGORY_LABELS } from '../../utils/catalogDisplay';
import {
  compareRowLabels,
  MAX_ROWS_PER_REQUEST,
  nextRowLabel,
  validateRowLabel,
  validateSeatCount,
  validateSeatRows,
} from '../../utils/catalogValidation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { makeLine, suggestLabel, type DraftRowLine } from './draftRows';

const categoryOptions = SEAT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

export interface AddSeatRowsPanelProps {
  venueId: number;
  /** Row labels already saved in the venue. */
  existingLabels: ReadonlySet<string>;
  lines: DraftRowLine[];
  onLinesChange: (lines: DraftRowLine[]) => void;
  /** After a successful save, or when the user discards the draft. */
  onDone: () => void;
}

/**
 * Describes new rows a line at a time, previewed on the map (dashed) before
 * they're saved in a single POST. The server creates the individual seats.
 */
export const AddSeatRowsPanel: React.FC<AddSeatRowsPanelProps> = ({ venueId, existingLabels, lines, onLinesChange, onDone }) => {
  const toast = useToast();
  const [addSeatRows, { isLoading }] = useAddSeatRowsMutation();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [quick, setQuick] = useState({ from: '', to: '', seats: '10', category: 'gold' as SeatCategory });
  const [quickError, setQuickError] = useState<string | null>(null);

  const { rowErrors, formError } = validateSeatRows(lines, existingLabels);
  const hasErrors = Boolean(formError) || rowErrors.some((e) => e.row || e.seats);
  const totalSeats = lines.reduce((sum, l) => sum + (validateSeatCount(l.seats) ? 0 : Number(l.seats)), 0);

  const update = (key: number, patch: Partial<DraftRowLine>) =>
    onLinesChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => {
    const last = lines.at(-1);
    const label = suggestLabel([...existingLabels, ...lines.map((l) => l.row)]);
    onLinesChange([...lines, makeLine(label, last?.seats ?? '10', last?.category ?? 'gold')]);
  };

  const applyQuickFill = (e: React.FormEvent) => {
    e.preventDefault();
    const from = quick.from.trim().toUpperCase();
    const to = quick.to.trim().toUpperCase();
    const labelError = validateRowLabel(from) ?? validateRowLabel(to);
    if (labelError) return setQuickError(labelError);
    if (compareRowLabels(from, to) > 0) return setQuickError(`Row ${from} comes after row ${to}`);
    const seatsError = validateSeatCount(quick.seats);
    if (seatsError) return setQuickError(seatsError);

    const labels: string[] = [];
    for (let label: string | null = from; label; label = label === to ? null : nextRowLabel(label)) {
      labels.push(label);
      if (labels.length > MAX_ROWS_PER_REQUEST) return setQuickError(`Cannot add more than ${MAX_ROWS_PER_REQUEST} rows at once`);
    }

    setQuickError(null);
    // Blank lines would sit above the filled rows as errors; drop them.
    const keep = lines.filter((l) => l.row.trim() !== '');
    onLinesChange([...keep, ...labels.map((l) => makeLine(l, quick.seats, quick.category))]);
    setQuick((q) => ({ ...q, from: '', to: '' }));
  };

  const save = async () => {
    setSubmitted(true);
    setServerError(null);
    if (hasErrors) return;

    const rows = lines.map((l) => ({ row: l.row.trim().toUpperCase(), seats: Number(l.seats), category: l.category }));
    try {
      await addSeatRows({ venueId, rows }).unwrap();
      toast(`Added ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} (${totalSeats} seats)`, 'success');
      setSubmitted(false);
      onLinesChange([]);
      onDone();
    } catch (err) {
      setServerError(getRtkErrorMessage(err));
    }
  };

  // Label clashes are worth showing as soon as a label is typed; blank or
  // half-typed fields only after a save attempt, so the form doesn't nag.
  const errorFor = (i: number, field: 'row' | 'seats') => {
    const error = rowErrors[i]?.[field];
    if (!error) return undefined;
    const filled = field === 'row' ? lines[i].row.trim() !== '' : lines[i].seats !== '';
    return submitted || filled ? error : undefined;
  };

  return (
    <section aria-labelledby="add-rows-title" className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px] p-5 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="add-rows-title" className="text-[17px] leading-6 font-semibold text-[var(--ink)]">
          Add rows
        </h2>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Row A is nearest the stage. Seats are numbered from 1 in each row.
        </p>
      </div>

      {lines.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[4.5rem_5.5rem_1fr_2.5rem] gap-2 text-caption text-[var(--ink-muted)]" aria-hidden="true">
            <span>Row</span>
            <span>Seats</span>
            <span>Category</span>
            <span />
          </div>
          <ul className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <li key={line.key} className="grid grid-cols-[4.5rem_5.5rem_1fr_2.5rem] gap-2 items-start">
                <Input
                  aria-label={`Row label, line ${i + 1}`}
                  value={line.row}
                  onChange={(e) => update(line.key, { row: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })}
                  error={errorFor(i, 'row')}
                  autoComplete="off"
                  className="uppercase font-medium"
                />
                <Input
                  aria-label={`Seats in row ${line.row || i + 1}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={line.seats}
                  onChange={(e) => update(line.key, { seats: e.target.value })}
                  error={errorFor(i, 'seats')}
                />
                <Select
                  aria-label={`Category of row ${line.row || i + 1}`}
                  value={line.category}
                  onChange={(e) => update(line.key, { category: e.target.value as SeatCategory })}
                  options={categoryOptions}
                />
                <button
                  type="button"
                  onClick={() => onLinesChange(lines.filter((l) => l.key !== line.key))}
                  aria-label={`Remove line ${line.row || i + 1}`}
                  className="h-11 w-10 inline-flex items-center justify-center rounded-full text-[var(--ink-muted)] hover:text-[var(--danger)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Button variant="secondary" size="sm" onClick={addLine} leftIcon={<Plus className="w-4 h-4" />}>
          Add row
        </Button>
      </div>

      <form onSubmit={applyQuickFill} className="flex flex-col gap-2 pt-4 border-t border-[var(--rule)]" aria-label="Quick fill">
        <span className="text-caption text-[var(--ink-muted)]">Quick fill</span>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--ink-secondary)]">
          <span>Rows</span>
          <Input
            aria-label="From row"
            value={quick.from}
            onChange={(e) => setQuick((q) => ({ ...q, from: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }))}
            placeholder="F"
            containerClassName="w-16!"
            className="uppercase"
          />
          <span>to</span>
          <Input
            aria-label="To row"
            value={quick.to}
            onChange={(e) => setQuick((q) => ({ ...q, to: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }))}
            placeholder="J"
            containerClassName="w-16!"
            className="uppercase"
          />
          <span>with</span>
          <Input
            aria-label="Seats per row"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={quick.seats}
            onChange={(e) => setQuick((q) => ({ ...q, seats: e.target.value }))}
            containerClassName="w-20!"
          />
          <span>seats,</span>
          <Select
            aria-label="Category"
            value={quick.category}
            onChange={(e) => setQuick((q) => ({ ...q, category: e.target.value as SeatCategory }))}
            options={categoryOptions}
            containerClassName="w-32!"
          />
          <Button type="submit" variant="ghost" size="sm">
            Fill
          </Button>
        </div>
        {quickError && <p className="text-[13px] text-[var(--danger)]">{quickError}</p>}
      </form>

      {submitted && formError && <Alert variant="danger">{formError}</Alert>}
      {serverError && (
        <Alert variant="warning" onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          onClick={() => {
            onLinesChange([]);
            setSubmitted(false);
            setServerError(null);
            onDone();
          }}
          disabled={isLoading}
        >
          Discard
        </Button>
        <Button onClick={save} isLoading={isLoading} disabled={lines.length === 0}>
          {lines.length === 0
            ? 'Save rows'
            : `Save ${lines.length} ${lines.length === 1 ? 'row' : 'rows'} (${totalSeats} seats)`}
        </Button>
      </div>
    </section>
  );
};
