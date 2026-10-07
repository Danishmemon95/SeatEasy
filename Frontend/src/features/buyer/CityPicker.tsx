/*
 * CityPicker — city selector (plan §0.3), in two modes:
 *   blocking: no city yet. Can't be dismissed (no X, Escape, backdrop or Skip).
 *   closable: changing city. Dismiss via X, backdrop click, Escape or Skip.
 *   Data: GET /catalog/cities (cities with upcoming events, most events first)
 *   Typing: filters the list; also allows selecting the entered city directly.
 */

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, ChevronRight, Check } from 'lucide-react';
import { useGetCitiesQuery } from '../../api/buyerApi';
import { getRtkErrorMessage } from '../../api/errors';

interface CityPickerProps {
  mode?: 'blocking' | 'closable';
  onClose?: () => void;
  onSave: (city: string) => Promise<void>;
  /** Pre-fill the input with this city (e.g. from localStorage on post-verify). */
  initialCity?: string;
}

export const CityPicker: React.FC<CityPickerProps> = ({
  mode = 'closable',
  onClose: onCloseProp,
  onSave,
  initialCity = '',
}) => {
  // A blocking picker ignores every way of dismissing it.
  const onClose = mode === 'blocking' ? undefined : onCloseProp;
  const [query, setQuery] = useState(initialCity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useGetCitiesQuery();

  // Auto-focus the search box and bind Escape key.
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const cities = data?.cities ?? [];
  const trimmed = query.trim();
  const filtered = trimmed
    ? cities.filter((c) => c.city.toLowerCase().includes(trimmed.toLowerCase()))
    : cities;

  const handlePick = async (cityName: string) => {
    const valid = cityName.trim();
    if (!valid || saving) return;
    // Same rule as the server (2–100 characters), so a typo is caught here.
    if (valid.length < 2) {
      setError('City must be at least 2 characters');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(valid);
      onClose?.();
    } catch (err) {
      // Keep the picker open with the reason; the previous city stays in effect.
      setError(getRtkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && trimmed) {
      e.preventDefault();
      handlePick(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 animate-[fade-in_var(--motion-base)_var(--ease)]"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your city"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="w-full max-w-md bg-[var(--paper-raised)] rounded-[16px] shadow-[var(--elev-3)] border border-[var(--rule)] flex flex-col overflow-hidden animate-[toast-in_var(--motion-base)_var(--ease)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="font-display font-medium text-2xl text-[var(--ink)] tracking-tight">
              Choose your city
            </h2>
            <p className="text-sm text-[var(--ink-secondary)] mt-1">
              We'll show events and screenings near you.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close city picker"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer -mr-2 -mt-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-muted)] pointer-events-none" />
            <input
              ref={inputRef}
              id="city-search"
              type="search"
              placeholder="Search or enter city…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-11 pl-10 pr-4 rounded-[10px] border border-[var(--rule)] bg-[var(--paper-raised)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-subtle)] transition-[border-color,box-shadow]"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="px-6 pb-3 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        )}

        {/* City list */}
        <div className="overflow-y-auto max-h-72 border-t border-[var(--rule)]">
          {isLoading ? (
            <div className="flex flex-col gap-2 px-6 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-[8px] bg-[var(--paper-sunken)] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="py-2">
              {/* Option to select typed custom city if entered */}
              {trimmed && !cities.some((c) => c.city.toLowerCase() === trimmed.toLowerCase()) && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handlePick(trimmed)}
                  className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-[var(--accent-subtle)] transition-colors cursor-pointer text-[var(--accent)] font-medium text-sm border-b border-[var(--rule)]"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>Select "{trimmed}"</span>
                  </div>
                  <Check className="w-4 h-4" />
                </button>
              )}

              {filtered.length === 0 && !trimmed ? (
                <div className="px-6 py-8 text-center">
                  <MapPin className="w-8 h-8 text-[var(--ink-faint)] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[var(--ink)]">
                    No cities with events yet
                  </p>
                  <p className="text-xs text-[var(--ink-muted)] mt-1">
                    Type a city name above to get started.
                  </p>
                </div>
              ) : (
                <>
                  {!trimmed && cities.length > 0 && (
                    <p className="text-caption text-[var(--ink-muted)] px-6 py-2">POPULAR CITIES</p>
                  )}
                  {filtered.map((c) => (
                    <button
                      key={c.city}
                      type="button"
                      disabled={saving}
                      onClick={() => handlePick(c.city)}
                      className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[var(--ink)]">{c.city}</p>
                          <p className="text-xs text-[var(--ink-muted)]">
                            {c.eventCount} {c.eventCount === 1 ? 'event' : 'events'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--ink-faint)]" />
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer with Skip / Browse without city */}
        {onClose && (
          <div className="px-6 py-3 border-t border-[var(--rule)] bg-[var(--paper-sunken)] flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>You can change this anytime</span>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--accent)] hover:underline font-medium cursor-pointer"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
