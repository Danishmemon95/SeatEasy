import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useGetVenuesQuery } from '../../api/catalog/venueEndpoints';
import { useGetVenueSeatsQuery } from '../../api/catalog/seatEndpoints';
import { getErrorStatus, getFieldErrors, getRtkErrorMessage } from '../../api/errors';
import {
  SEAT_CATEGORIES,
  type PricesInput,
  type Screening,
  type ScreeningUpdate,
  type SeatCategory,
  type Show,
} from '../../types/catalog.types';
import { validatePrices, validatePrice, validateStartsAt } from '../../utils/catalogValidation';
import { CATEGORY_LABELS } from '../../utils/catalogDisplay';
import {
  SCREENING_BUFFER_MINUTES,
  addMinutes,
  formatDuration,
  formatINR,
  formatShowtime,
  formatTime,
  istDateKey,
  maxStartDate,
  minStartDate,
  splitForForm,
  toApiDateTime,
} from '../../utils/datetime';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SeatSwatch } from '../../components/ui/SeatSwatch';
import { Skeleton } from '../../components/ui/Skeleton';
import { UnsavedChangesGuard } from '../../components/ui/UnsavedChangesGuard';

type PriceValues = Record<SeatCategory, string>;
type PriceErrors = Partial<Record<SeatCategory, string>>;

interface Errors {
  venueId?: string;
  startsAt?: string;
  prices: PriceErrors;
}

const NO_ERRORS: Errors = { prices: {} };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
/** What the price inputs accept while typing: digits and at most two decimals. */
const PRICE_INPUT_RE = /^\d*(\.\d{0,2})?$/;

const toPriceValues = (prices?: Screening['prices']): PriceValues => ({
  gold: prices?.gold !== undefined ? String(Number(prices.gold)) : '',
  platinum: prices?.platinum !== undefined ? String(Number(prices.platinum)) : '',
  sofa: prices?.sofa !== undefined ? String(Number(prices.sofa)) : '',
});

/** Prices as the API wants them: only the venue's categories, as numbers. */
const toPricesInput = (prices: PriceValues, categories: readonly SeatCategory[]): PricesInput =>
  Object.fromEntries(categories.map((c) => [c, Number(prices[c])]));

const Step: React.FC<{ n: number; title: string; enabled: boolean; children: React.ReactNode }> = ({
  n,
  title,
  enabled,
  children,
}) => (
  <fieldset
    disabled={!enabled}
    className={`pt-6 border-t border-[var(--rule)] first:pt-0 first:border-t-0 min-w-0 transition-opacity ${enabled ? '' : 'opacity-50'}`}
  >
    <legend className="float-left w-full mb-4">
      <span className="flex items-center gap-2.5 text-caption text-[var(--ink-muted)]">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[var(--rule-strong)] text-[11px] tabular-nums text-[var(--ink-secondary)]"
        >
          {n}
        </span>
        {title}
      </span>
    </legend>
    <div className="clear-left flex flex-col gap-4">{children}</div>
  </fieldset>
);

export interface ScreeningFormProps {
  show: Pick<Show, 'id' | 'orgId' | 'title' | 'durationMinutes'>;
  /** Present when editing; the form then sends only the fields that changed. */
  screening?: Screening;
  /** Admins pick from the show organizer's venues; organizers from their own. */
  isAdmin: boolean;
  submitLabel: string;
  /** Performs the save. Resolves with the saved screening, rejects with the RTK Query error. */
  onSubmit: (values: ScreeningUpdate) => Promise<Screening>;
  /** Runs once the unsaved-changes guard is released; navigate from here. */
  onSaved: (screening: Screening) => void;
  onCancel: () => void;
}

/**
 * Schedule or edit a screening (plan §6.8): one page, three stacked steps —
 * venue, date & time, prices — each enabled once the one before it is filled.
 */
export const ScreeningForm: React.FC<ScreeningFormProps> = ({
  show,
  screening,
  isAdmin,
  submitLabel,
  onSubmit,
  onSaved,
  onCancel,
}) => {
  const initialStart = screening ? splitForForm(screening.startsAt) : { date: '', time: '' };
  const initialPrices = toPriceValues(screening?.prices);

  const [venueId, setVenueId] = useState<number | null>(screening?.venueId ?? null);
  const [date, setDate] = useState(initialStart.date);
  const [time, setTime] = useState(initialStart.time);
  const [prices, setPrices] = useState<PriceValues>(initialPrices);
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  // A 409 (overlap, venue without seats, became read-only): "try something else", so warning tone.
  const [conflict, setConflict] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState<Screening | null>(null);
  // Fixed for the life of the form, so the date picker's bounds don't shift mid-edit.
  const [bounds] = useState(() => ({ min: minStartDate(), max: maxStartDate() }));

  const navigate = useNavigate();
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (saved) onSavedRef.current(saved);
  }, [saved]);

  // ---- Data -------------------------------------------------------------

  // The venue must belong to the show's organizer, even when an admin schedules.
  const venuesQuery = useGetVenuesQuery({ pageSize: 100, ...(isAdmin ? { ownerId: show.orgId } : {}) });
  const venues = venuesQuery.data?.venues ?? [];

  const seatsQuery = useGetVenueSeatsQuery(venueId ?? 0, { skip: venueId === null });
  // currentData, not data: right after switching venues, `data` still holds the
  // previous venue's seats, and its categories must not be priced or sent.
  const summary = venueId !== null ? seatsQuery.currentData?.summary : undefined;
  const categories = summary ? SEAT_CATEGORIES.filter((c) => summary[c] > 0) : [];

  // ---- Derived ----------------------------------------------------------

  const timeFilled = DATE_RE.test(date) && TIME_RE.test(time);
  const startsAt = timeFilled ? toApiDateTime(date, time) : null;

  const venueChanged = Boolean(screening) && venueId !== screening!.venueId;
  const startChanged = !screening || date !== initialStart.date || time !== initialStart.time;
  const pricesChanged =
    !screening || categories.some((c) => prices[c] === '' || Number(prices[c]) !== Number(initialPrices[c]));
  const isDirty = screening
    ? venueChanged || startChanged || pricesChanged
    : venueId !== null || date !== '' || time !== '' || SEAT_CATEGORIES.some((c) => prices[c] !== '');

  const venueStepDone = venueId !== null;
  const timeStepDone = venueStepDone && timeFilled;

  const allPricesValid = categories.length > 0 && categories.every((c) => !validatePrice(prices[c]));
  const potentialGross =
    allPricesValid && summary ? categories.reduce((sum, c) => sum + Number(prices[c]) * summary[c], 0) : null;

  // Soft warning: a higher tier priced below a lower one is allowed, but usually a typo.
  const ladderWarning = (() => {
    if (!allPricesValid) return null;
    for (let i = 1; i < categories.length; i++) {
      const lower = categories[i - 1];
      const higher = categories[i];
      if (Number(prices[higher]) < Number(prices[lower])) {
        return `${CATEGORY_LABELS[higher]} is priced below ${CATEGORY_LABELS[lower]}. Check that's intended.`;
      }
    }
    return null;
  })();

  const readout = (() => {
    if (!startsAt) return null;
    const ends = addMinutes(startsAt, show.durationMinutes);
    const freeFrom = addMinutes(startsAt, -SCREENING_BUFFER_MINUTES);
    const freeTo = addMinutes(ends.toISOString(), SCREENING_BUFFER_MINUTES);
    const nextDay = istDateKey(ends) !== istDateKey(startsAt) ? ' (next day)' : '';
    return (
      <>
        <span className="text-[var(--ink)]">
          {formatShowtime(startsAt)} – {formatTime(ends)}
          {nextDay} IST ({formatDuration(show.durationMinutes)}).
        </span>{' '}
        The venue must be free from {formatTime(freeFrom)} to {formatTime(freeTo)}.
      </>
    );
  })();

  // ---- Handlers ---------------------------------------------------------

  const selectVenue = (id: number) => {
    setVenueId(id);
    setConflict(null);
    // Prices are kept per category, so values carry over to the new venue's
    // matching categories; only stale errors are dropped.
    setErrors((prev) => ({ ...prev, venueId: undefined, prices: {} }));
  };

  const validateStart = (): string | undefined => {
    if (!startsAt) return 'Pick a date and a time';
    // An untouched start on an existing screening isn't re-sent, so it isn't re-checked.
    if (!startChanged) return undefined;
    return validateStartsAt(startsAt) ?? undefined;
  };

  const blurStart = () => {
    // Only once both halves are in; a half-filled pair isn't an error yet.
    if (date && time) setErrors((prev) => ({ ...prev, startsAt: validateStart() }));
  };

  const setPrice = (c: SeatCategory, value: string) => {
    if (!PRICE_INPUT_RE.test(value)) return;
    setPrices((prev) => ({ ...prev, [c]: value }));
    if (errors.prices[c] && !validatePrice(value)) {
      setErrors((prev) => ({ ...prev, prices: { ...prev.prices, [c]: undefined } }));
    }
  };

  const blurPrice = (c: SeatCategory) => {
    setErrors((prev) => ({ ...prev, prices: { ...prev.prices, [c]: validatePrice(prices[c]) ?? undefined } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setConflict(null);

    const next: Errors = {
      venueId: venueId === null ? 'Choose a venue' : undefined,
      startsAt: validateStart(),
      prices: validatePrices(prices, categories),
    };
    setErrors(next);
    if (next.venueId || next.startsAt || Object.keys(next.prices).length > 0) return;
    if (categories.length === 0) {
      setFormError(seatsQuery.isFetching ? 'Still loading the venue’s seats. Try again in a moment.' : 'This venue has no seats yet.');
      return;
    }

    let payload: ScreeningUpdate;
    if (screening) {
      payload = {};
      if (venueChanged) payload.venueId = venueId!;
      if (startChanged) payload.startsAt = startsAt!;
      // A new venue needs prices for its own categories, so they go with it.
      if (venueChanged || pricesChanged) payload.prices = toPricesInput(prices, categories);
    } else {
      payload = { venueId: venueId!, startsAt: startsAt!, prices: toPricesInput(prices, categories) };
    }

    setIsSubmitting(true);
    try {
      setSaved(await onSubmit(payload));
    } catch (error) {
      const fieldErrors = getFieldErrors(error);
      if (fieldErrors) {
        const priceErrors: PriceErrors = {};
        for (const c of SEAT_CATEGORIES) if (fieldErrors[`prices.${c}`]) priceErrors[c] = fieldErrors[`prices.${c}`];
        setErrors({ venueId: fieldErrors.venueId, startsAt: fieldErrors.startsAt, prices: priceErrors });
      }
      if (getErrorStatus(error) === 409) setConflict(getRtkErrorMessage(error));
      else setFormError(getRtkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Render -----------------------------------------------------------

  const venueStep = (() => {
    if (venuesQuery.isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      );
    }
    if (venuesQuery.error) {
      return (
        <Alert variant="danger">
          {getRtkErrorMessage(venuesQuery.error)}{' '}
          <button type="button" className="underline cursor-pointer" onClick={() => venuesQuery.refetch()}>
            Retry
          </button>
        </Alert>
      );
    }
    if (venues.length === 0) {
      return (
        <div className="flex flex-col items-start gap-3 p-4 rounded-[10px] border border-dashed border-[var(--rule-strong)]">
          <p className="text-sm text-[var(--ink-secondary)]">
            {isAdmin ? "This event's organizer hasn't added a venue yet." : 'You need a venue first.'}
          </p>
          {!isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/organizer/venues/new')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New venue
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {venues.map((v) => {
          const empty = v.seatCount === 0;
          return (
            <div key={v.id} className="flex flex-col gap-1">
              <label
                className={[
                  'flex flex-col gap-1 p-4 rounded-[10px] border bg-[var(--paper-raised)] transition-colors',
                  empty
                    ? 'border-[var(--rule)] opacity-60 cursor-not-allowed'
                    : 'border-[var(--rule)] cursor-pointer hover:border-[var(--rule-strong)]',
                  'has-[:checked]:border-[var(--accent)] has-[:checked]:shadow-[0_0_0_1px_var(--accent)]',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] has-[:focus-visible]:outline-offset-2',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="venue"
                  value={v.id}
                  checked={venueId === v.id}
                  disabled={empty}
                  onChange={() => selectVenue(v.id)}
                  className="sr-only"
                />
                <span className="text-[15px] font-medium text-[var(--ink)] truncate">{v.name}</span>
                <span className="text-[13px] text-[var(--ink-muted)] truncate">
                  {v.city} · <span className="tabular-nums">{empty ? 'No seats yet' : `${v.seatCount} seats`}</span>
                </span>
              </label>
              {empty && (
                <Link to={`/organizer/venues/${v.id}`} className="text-[13px] link-underline text-[var(--ink-secondary)] self-start">
                  Build layout →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    );
  })();

  const priceStep = (() => {
    if (!venueStepDone) return null;
    if (!seatsQuery.currentData && !seatsQuery.error) {
      return (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-11 max-w-[320px]" />
          <Skeleton className="h-11 max-w-[320px]" />
        </div>
      );
    }
    if (seatsQuery.error) {
      return (
        <Alert variant="danger">
          {getRtkErrorMessage(seatsQuery.error)}{' '}
          <button type="button" className="underline cursor-pointer" onClick={() => seatsQuery.refetch()}>
            Retry
          </button>
        </Alert>
      );
    }
    if (!summary || categories.length === 0) {
      return <Alert variant="warning">This venue has no seats yet; add its seat layout first.</Alert>;
    }
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 max-w-[320px]">
          {categories.map((c) => (
            <div key={c} className="flex items-start gap-3">
              <SeatSwatch category={c} className="mt-[38px]" />
              <Input
                label={`${CATEGORY_LABELS[c]} · ${summary[c]} seats`}
                value={prices[c]}
                onChange={(e) => setPrice(c, e.target.value)}
                onBlur={() => blurPrice(c)}
                error={errors.prices[c]}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                leftIcon={<span className="text-[15px] text-[var(--ink-muted)]">₹</span>}
                className="tabular-nums"
                required
              />
            </div>
          ))}
        </div>
        {potentialGross !== null && (
          <p className="text-[15px] text-[var(--ink-secondary)]">
            Potential gross <strong className="font-semibold text-[var(--ink)] tabular-nums">{formatINR(potentialGross)}</strong>
            <span className="text-[13px] text-[var(--ink-muted)]"> if every seat sells</span>
          </p>
        )}
        {ladderWarning && <Alert variant="warning">{ladderWarning}</Alert>}
      </div>
    );
  })();

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <UnsavedChangesGuard when={isDirty && !saved} />

      {formError && (
        <Alert variant="danger" onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <Step n={1} title="VENUE" enabled>
          {venueStep}
          {errors.venueId && <p className="text-[13px] text-[var(--danger)]">{errors.venueId}</p>}
        </Step>

        <Step n={2} title="DATE & TIME" enabled={venueStepDone}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[480px]">
            <Input
              label="Date"
              type="date"
              value={date}
              min={bounds.min}
              max={bounds.max}
              onChange={(e) => {
                setDate(e.target.value);
                setConflict(null);
              }}
              onBlur={blurStart}
              error={errors.startsAt}
              required
            />
            <Input
              label="Start time"
              type="time"
              step={900}
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setConflict(null);
              }}
              onBlur={blurStart}
              aria-invalid={Boolean(errors.startsAt)}
              className="tabular-nums"
              required
            />
          </div>
          {readout && <p className="text-sm leading-6 text-[var(--ink-secondary)] tabular-nums">{readout}</p>}
          <p className="text-[13px] text-[var(--ink-muted)]">
            All times are India Standard Time. Bookable from 24 hours to 180 days ahead.
          </p>
        </Step>

        <Step n={3} title="PRICES" enabled={timeStepDone}>
          {priceStep ?? <p className="text-[13px] text-[var(--ink-muted)]">Choose a venue to see its seat categories.</p>}
        </Step>
      </div>

      {conflict && <Alert variant="warning">{conflict}</Alert>}

      {/* A sticky action bar on phones, where the form is long. */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-[var(--paper)] border-t border-[var(--rule)] sm:static sm:mx-0 sm:px-0 sm:py-0 sm:pt-2 sm:border-t-0 sm:bg-transparent flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="lg" isLoading={isSubmitting} disabled={Boolean(screening) && !isDirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
