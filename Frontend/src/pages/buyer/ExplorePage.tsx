/*
 * ExplorePage — the full filtered event list (plan §0.6, §4.1)
 * Filters: type chips + date chips, all in the URL.
 * Grid: 2 cols mobile, 3 md, 4 xl.
 */

import { useState } from 'react';
import { useGetCatalogEventsQuery } from '../../api/buyerApi';
import { useCurrentCity } from '../../app/useCurrentCity';
import { useChoiceParam, usePageParam } from '../../app/urlState';
import { EventCard } from '../../components/ui/EventCard';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryErrorState } from '../../components/ui/QueryErrorState';
import { CityPicker } from '../../features/buyer/CityPicker';
import { SHOW_TYPES, type ShowType } from '../../types/catalog.types';
import { SHOW_TYPE_LABELS } from '../../utils/catalogDisplay';
import { istDateKey } from '../../utils/datetime';
import { Search } from 'lucide-react';
import { useAppTitle } from '../../app/useDocumentTitle';

const DATE_CHOICES = ['any', 'today', 'tomorrow', 'weekend', ...generateNextDays()] as const;

function generateNextDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 2; i < 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    days.push(istDateKey(d));
  }
  return days;
}

function resolveDateParam(choice: string): string | undefined {
  if (choice === 'any') return undefined;
  if (choice === 'today') return istDateKey(new Date());
  if (choice === 'tomorrow') {
    return istDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  }
  // The API resolves "weekend" itself (this Sat + Sun in IST), the same range
  // as the home page's weekend row.
  if (choice === 'weekend') return 'weekend';
  return choice; // A YYYY-MM-DD key
}

function dateLabel(choice: string): string {
  if (choice === 'any') return 'Any';
  if (choice === 'today') return 'Today';
  if (choice === 'tomorrow') return 'Tomorrow';
  if (choice === 'weekend') return 'Weekend';
  // Format the date nicely
  try {
    const d = new Date(choice);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  } catch {
    return choice;
  }
}

const TYPE_CHOICES = ['all', ...SHOW_TYPES] as const;

export function ExplorePage() {
  useAppTitle('Explore Events');
  const { city: currentCity, saveCity } = useCurrentCity();
  // SiteLayout only renders this page once a city is chosen.
  const city = currentCity!;
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [page, setPage] = usePageParam();
  const [dateChoice, setDateChoice] = useChoiceParam('date', DATE_CHOICES);
  const [typeChoice, setTypeChoice] = useChoiceParam('type', TYPE_CHOICES);

  const resolvedDate = resolveDateParam(dateChoice);
  const resolvedType = typeChoice !== 'all' ? (typeChoice as ShowType) : undefined;

  const { data, isLoading, isError, error, refetch } = useGetCatalogEventsQuery({
    city,
    date: resolvedDate,
    type: resolvedType,
    page,
    pageSize: 24,
  });

  const events = data?.events ?? [];
  const pagination = data?.pagination;

  const hasFilters = dateChoice !== 'any' || typeChoice !== 'all';

  const clearFilters = () => {
    setDateChoice('any');
    setTypeChoice('all');
    setPage(1);
  };

  return (
    <div className="max-w-[var(--container-default)] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-[var(--ink-muted)] mb-1">EVENTS IN</p>
          <h1
            className="font-display font-medium text-3xl sm:text-4xl text-[var(--ink)] tracking-tight"
            style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 40" }}
          >
            {city}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCityPicker(true)}
          className="text-xs sm:text-sm font-medium text-[var(--accent)] hover:underline cursor-pointer"
        >
          Change city
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Date chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-[var(--ink-muted)] shrink-0">DATE</span>
          {DATE_CHOICES.slice(0, 7).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDateChoice(d); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                dateChoice === d
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                  : 'bg-[var(--paper-raised)] text-[var(--ink-secondary)] border-[var(--rule)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]'
              }`}
            >
              {dateLabel(d)}
            </button>
          ))}
        </div>

        {/* Type chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-[var(--ink-muted)] shrink-0">TYPE</span>
          {TYPE_CHOICES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTypeChoice(t); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                typeChoice === t
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                  : 'bg-[var(--paper-raised)] text-[var(--ink-secondary)] border-[var(--rule)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]'
              }`}
            >
              {t === 'all' ? 'All' : SHOW_TYPE_LABELS[t as ShowType]}
            </button>
          ))}
        </div>
      </div>

      {/* Content grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="w-full aspect-[2/3] rounded-[10px] bg-[var(--paper-sunken)] animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-[var(--paper-sunken)] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[var(--paper-sunken)] animate-pulse" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState error={error} onRetry={refetch} noun="events" />
      ) : events.length === 0 ? (
        <EmptyState
          heading="Nothing on for these filters."
          description={hasFilters ? 'Try adjusting or clearing your filters.' : 'No published events yet.'}
          action={
            hasFilters
              ? { label: 'Clear filters', onClick: clearFilters }
              : undefined
          }
          icon={<Search className="w-8 h-8" />}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          pagination={pagination}
          noun="events"
          onPageChange={setPage}
        />
      )}

      {/* City Picker Modal */}
      {showCityPicker && (
        <CityPicker
          onClose={() => setShowCityPicker(false)}
          onSave={async (c) => {
            await saveCity(c);
            setShowCityPicker(false);
          }}
        />
      )}
    </div>
  );
}
