import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getFieldErrors, getRtkErrorMessage } from '../../api/errors';
import type { Venue, VenueInput } from '../../types/catalog.types';
import { validateVenueAddress, validateVenueCity, validateVenueName } from '../../utils/catalogValidation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { UnsavedChangesGuard } from '../../components/ui/UnsavedChangesGuard';

type Field = keyof VenueInput;
type Errors = Partial<Record<Field, string>>;

const FIELDS: Field[] = ['name', 'city', 'address'];

const validators: Record<Field, (v: string) => string | null> = {
  name: validateVenueName,
  city: validateVenueCity,
  address: validateVenueAddress,
};

export interface VenueFormProps {
  /** Present when editing; the form then sends only the fields that changed. */
  venue?: Venue;
  submitLabel: string;
  /** Performs the save. Resolves with the saved venue, rejects with the RTK Query error. */
  onSubmit: (values: Partial<VenueInput>) => Promise<Venue>;
  /**
   * Runs after the save, once the unsaved-changes guard has been released —
   * navigate from here, not from onSubmit, or the guard blocks the redirect.
   */
  onSaved: (venue: Venue) => void;
  onCancel: () => void;
}

export const VenueForm: React.FC<VenueFormProps> = ({ venue, submitLabel, onSubmit, onSaved, onCancel }) => {
  const initial: VenueInput = {
    name: venue?.name ?? '',
    city: venue?.city ?? '',
    address: venue?.address ?? '',
  };

  const [values, setValues] = useState<VenueInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Holds the saved venue once the save succeeds; the guard is released on that
  // render, and the effect below hands off to onSaved.
  const [saved, setSaved] = useState<Venue | null>(null);

  // Read through a ref so the effect runs once per save, not again whenever the
  // parent re-renders with a new callback.
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (saved) onSavedRef.current(saved);
  }, [saved]);

  const changedFields = FIELDS.filter((f) => values[f].trim() !== initial[f].trim());
  const isDirty = changedFields.length > 0;

  const setField = (field: Field, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a shown error as soon as the input becomes valid; don't add new ones mid-typing.
    if (errors[field] && !validators[field](value)) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateField = (field: Field) => {
    const error = validators[field](values[field]);
    setErrors((prev) => ({ ...prev, [field]: error ?? undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors: Errors = {};
    for (const f of FIELDS) {
      const error = validators[f](values[f]);
      if (error) nextErrors[f] = error;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const fieldsToSend = venue ? changedFields : FIELDS;
    const payload: Partial<VenueInput> = {};
    for (const f of fieldsToSend) payload[f] = values[f].trim();

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

      <Input
        label="Name"
        value={values.name}
        onChange={(e) => setField('name', e.target.value)}
        onBlur={() => validateField('name')}
        error={errors.name}
        placeholder="e.g. Mexus Cinemas"
        autoComplete="off"
        autoFocus={!venue}
        required
      />

      <Input
        label="City"
        value={values.city}
        onChange={(e) => setField('city', e.target.value)}
        onBlur={() => validateField('city')}
        error={errors.city}
        placeholder="e.g. Bhavnagar"
        autoComplete="address-level2"
        required
      />

      <Textarea
        label="Address"
        value={values.address}
        onChange={(e) => setField('address', e.target.value)}
        onBlur={() => validateField('address')}
        error={errors.address}
        placeholder="Street, landmark, area"
        autoComplete="street-address"
        maxChars={300}
        rows={3}
        required
      />

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="lg" isLoading={isSubmitting} disabled={Boolean(venue) && !isDirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
