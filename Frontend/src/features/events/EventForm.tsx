import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getFieldErrors, getRtkErrorMessage } from '../../api/errors';
import {
  AGE_RATINGS,
  SHOW_TYPES,
  type AgeRating,
  type Show,
  type ShowInput,
  type ShowType,
  type ShowUpdate,
} from '../../types/catalog.types';
import {
  MAX_DURATION_MINUTES,
  validateDuration,
  validatePosterUrl,
  validateShowDescription,
  validateShowGenre,
  validateShowLanguage,
  validateShowTitle,
} from '../../utils/catalogValidation';
import { AGE_RATING_MEANINGS, SHOW_TYPE_LABELS } from '../../utils/catalogDisplay';
import { formatDuration } from '../../utils/datetime';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { UnsavedChangesGuard } from '../../components/ui/UnsavedChangesGuard';
import { Poster } from './Poster';

/** Form state: everything as typed, so a half-entered duration isn't coerced to 0. */
interface Values {
  title: string;
  type: ShowType | '';
  genre: string;
  language: string;
  durationMinutes: string;
  ageRating: AgeRating | '';
  description: string;
  posterUrl: string;
}

type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const FIELDS: Field[] = ['title', 'type', 'genre', 'language', 'durationMinutes', 'ageRating', 'description', 'posterUrl'];

const validators: Record<Field, (v: string) => string | null> = {
  title: validateShowTitle,
  type: (v) => (v ? null : 'Choose a type'),
  genre: validateShowGenre,
  language: validateShowLanguage,
  durationMinutes: validateDuration,
  ageRating: (v) => (v ? null : 'Choose an age rating'),
  description: validateShowDescription,
  posterUrl: validatePosterUrl,
};

const toValues = (show?: Show): Values => ({
  title: show?.title ?? '',
  type: show?.type ?? '',
  genre: show?.genre ?? '',
  language: show?.language ?? '',
  durationMinutes: show ? String(show.durationMinutes) : '',
  ageRating: show?.ageRating ?? '',
  description: show?.description ?? '',
  posterUrl: show?.posterUrl ?? '',
});

/** Valid values as the API wants them: trimmed, the optional fields null when empty. */
const toInput = (v: Values): ShowInput => ({
  title: v.title.trim(),
  type: v.type as ShowType,
  genre: v.genre.trim() || null,
  language: v.language.trim(),
  durationMinutes: Number(v.durationMinutes),
  ageRating: v.ageRating as AgeRating,
  description: v.description.trim(),
  posterUrl: v.posterUrl.trim() || null,
});

/** Comparable form of each field, so whitespace or "090" vs "90" doesn't count as an edit. */
const normalize = (v: Values): Record<Field, string> => {
  const duration = v.durationMinutes.trim();
  return {
    title: v.title.trim(),
    type: v.type,
    genre: v.genre.trim(),
    language: v.language.trim(),
    durationMinutes: duration !== '' && Number.isFinite(Number(duration)) ? String(Number(duration)) : duration,
    ageRating: v.ageRating,
    description: v.description.trim(),
    posterUrl: v.posterUrl.trim(),
  };
};

/** The poster preview follows the URL field after a pause, not on every keystroke. */
const useDebounced = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-5 pt-6 border-t border-[var(--rule)] first:pt-0 first:border-t-0">
    <h2 className="text-caption text-[var(--ink-muted)]">{title}</h2>
    {children}
  </section>
);

export interface EventFormProps {
  /** Present when editing; the form then sends only the fields that changed. */
  show?: Show;
  /**
   * The show has a scheduled screening, whose end time was computed from the
   * duration, so the API rejects a new duration (409). The field is disabled.
   */
  durationLocked?: boolean;
  submitLabel: string;
  /** Performs the save. Resolves with the saved show, rejects with the RTK Query error. */
  onSubmit: (values: ShowUpdate) => Promise<Show>;
  /**
   * Runs after the save, once the unsaved-changes guard has been released —
   * navigate from here, not from onSubmit, or the guard blocks the redirect.
   */
  onSaved: (show: Show) => void;
  onCancel: () => void;
}

export const EventForm: React.FC<EventFormProps> = ({
  show,
  durationLocked = false,
  submitLabel,
  onSubmit,
  onSaved,
  onCancel,
}) => {
  const initial = toValues(show);

  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Holds the saved show once the save succeeds; the guard is released on that
  // render, and the effect below hands off to onSaved.
  const [saved, setSaved] = useState<Show | null>(null);

  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (saved) onSavedRef.current(saved);
  }, [saved]);

  // A locked duration is shown as saved and never sent, even if it was edited
  // before the lock was discovered (a 409 refetches the show).
  const durationValue = durationLocked ? initial.durationMinutes : values.durationMinutes;
  const effective: Values = { ...values, durationMinutes: durationValue };

  const now = normalize(effective);
  const before = normalize(initial);
  const changedFields = FIELDS.filter((f) => now[f] !== before[f]);
  const isDirty = changedFields.length > 0;

  const debouncedPoster = useDebounced(values.posterUrl.trim(), 400);
  const previewUrl = debouncedPoster && !validatePosterUrl(debouncedPoster) ? debouncedPoster : null;

  const durationError = validateDuration(durationValue);
  const durationHelper = durationLocked
    ? 'Locked while screenings are scheduled. Cancel them to change the duration.'
    : durationError
      ? `Whole minutes, up to ${MAX_DURATION_MINUTES} (12 hours).`
      : `= ${formatDuration(Number(durationValue))}`;

  const setField = <F extends Field>(field: F, value: Values[F]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a shown error as soon as the input becomes valid; don't add new ones mid-typing.
    if (errors[field] && !validators[field](value)) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateField = (field: Field) => {
    const error = validators[field](effective[field]);
    setErrors((prev) => ({ ...prev, [field]: error ?? undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors: Errors = {};
    for (const f of FIELDS) {
      const error = validators[f](effective[f]);
      if (error) nextErrors[f] = error;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = toInput(effective);
    let payload: ShowUpdate;
    if (show) {
      // PUT is strict: only what changed. A cleared genre/poster goes as null.
      payload = Object.fromEntries(changedFields.map((f) => [f, input[f]])) as ShowUpdate;
    } else {
      // On create, an empty optional field is simply left out.
      const { genre, posterUrl, ...rest } = input;
      payload = { ...rest, ...(genre ? { genre } : {}), ...(posterUrl ? { posterUrl } : {}) };
    }

    setIsSubmitting(true);
    try {
      setSaved(await onSubmit(payload));
    } catch (error) {
      const fieldErrors = getFieldErrors(error);
      if (fieldErrors) {
        setErrors((prev) => ({
          ...prev,
          ...Object.fromEntries(FIELDS.filter((f) => fieldErrors[f]).map((f) => [f, fieldErrors[f]])),
        }));
      }
      setFormError(getRtkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <UnsavedChangesGuard when={isDirty && !saved} />

      {formError && (
        <Alert variant="danger" onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <Section title="BASICS">
          <Input
            label="Title"
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            onBlur={() => validateField('title')}
            error={errors.title}
            placeholder="e.g. The Midnight Sky"
            autoComplete="off"
            autoFocus={!show}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Select
              label="Type"
              value={values.type}
              onChange={(e) => setField('type', e.target.value as ShowType)}
              onBlur={() => validateField('type')}
              error={errors.type}
              placeholder="Choose a type"
              options={SHOW_TYPES.map((t) => ({ value: t, label: SHOW_TYPE_LABELS[t] }))}
              required
            />
            <Input
              label="Language"
              value={values.language}
              onChange={(e) => setField('language', e.target.value)}
              onBlur={() => validateField('language')}
              error={errors.language}
              placeholder="e.g. Hindi"
              autoComplete="off"
              required
            />
          </div>

          <Input
            label="Genre (optional)"
            value={values.genre}
            onChange={(e) => setField('genre', e.target.value)}
            onBlur={() => validateField('genre')}
            error={errors.genre}
            placeholder="e.g. Drama"
            autoComplete="off"
          />

          <fieldset className="flex flex-col gap-1.5" aria-describedby="age-rating-help">
            <legend className="text-caption text-[var(--ink-muted)] mb-1.5">Age rating</legend>
            <div className="grid grid-cols-3 gap-1 p-1 max-w-[320px] bg-[var(--paper-sunken)] rounded-[8px] border border-[var(--rule)]">
              {AGE_RATINGS.map((r) => (
                <label
                  key={r}
                  title={AGE_RATING_MEANINGS[r]}
                  className={[
                    'flex items-center justify-center h-9 rounded-[6px] text-sm font-medium cursor-pointer select-none transition-colors',
                    'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--paper-raised)]/60',
                    'has-[:checked]:bg-[var(--paper-raised)] has-[:checked]:text-[var(--ink)] has-[:checked]:border has-[:checked]:border-[var(--rule)] has-[:checked]:shadow-[var(--elev-1)]',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] has-[:focus-visible]:outline-offset-1',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="ageRating"
                    value={r}
                    checked={values.ageRating === r}
                    onChange={() => setField('ageRating', r)}
                    className="sr-only"
                  />
                  {r}
                </label>
              ))}
            </div>
            <p
              id="age-rating-help"
              className={`text-[13px] mt-0.5 ${errors.ageRating ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'}`}
            >
              {errors.ageRating ?? (values.ageRating ? AGE_RATING_MEANINGS[values.ageRating] : 'U, UA or A, as certified.')}
            </p>
          </fieldset>
        </Section>

        <Section title="TIMING">
          <Input
            label="Duration (minutes)"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DURATION_MINUTES}
            step={1}
            value={durationValue}
            onChange={(e) => setField('durationMinutes', e.target.value)}
            onBlur={() => validateField('durationMinutes')}
            error={errors.durationMinutes}
            helperText={durationHelper}
            disabled={durationLocked}
            containerClassName="max-w-[240px]"
            className="tabular-nums"
            required
          />
        </Section>

        <Section title="DESCRIPTION">
          <Textarea
            label="Description"
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            onBlur={() => validateField('description')}
            error={errors.description}
            placeholder="What buyers should know: the story, the line-up, what to expect."
            maxChars={5000}
            rows={6}
            required
          />
        </Section>

        <Section title="POSTER">
          <div className="flex flex-col-reverse sm:flex-row gap-6 sm:items-start">
            <Input
              label="Poster URL (optional)"
              type="url"
              inputMode="url"
              value={values.posterUrl}
              onChange={(e) => setField('posterUrl', e.target.value)}
              onBlur={() => validateField('posterUrl')}
              error={errors.posterUrl}
              helperText="An https link to a 2:3 image. Leave empty for no poster."
              placeholder="https://"
              autoComplete="off"
              containerClassName="flex-1 min-w-0"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-[var(--ink-muted)]" aria-hidden="true">
                Preview
              </span>
              <Poster
                url={previewUrl}
                title={values.title || 'Poster'}
                size="lg"
                alt={previewUrl ? 'Poster preview' : ''}
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="lg" isLoading={isSubmitting} disabled={Boolean(show) && !isDirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
