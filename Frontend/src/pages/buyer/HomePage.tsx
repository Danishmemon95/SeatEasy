/*
 * HomePage — city-first home (plan §0.5, design §11.1)
 *
 * Sections (top→bottom):
 *   1. Hero carousel (up to 5 featured events, soonest screenings)
 *   2. "This weekend" row
 *   3. One row per category, each with "See all →"
 *
 * A city is always set here: SiteLayout shows the blocking picker until one is.
 * If all sections empty: "Nothing on in <city>" + change city.
 */

import type React from 'react';
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MapPin,
  Clock,
} from 'lucide-react';
import { useGetHomeQuery } from '../../api/buyerApi';
import { useCurrentCity } from '../../app/useCurrentCity';
import { CityPicker } from '../../features/buyer/CityPicker';
import { EventCard } from '../../components/ui/EventCard';
import { Poster } from '../../components/ui/Poster';
import { SHOW_TYPE_LABELS } from '../../utils/catalogDisplay';
import { formatTime, formatDay, formatINR } from '../../utils/datetime';
import type { HomeSection, FeaturedCard, CatalogCard } from '../../types/buyer.types';
import type { ShowType } from '../../types/catalog.types';

// ---- Hero Carousel -------------------------------------------------------

const HeroCarousel: React.FC<{ featured: FeaturedCard[] }> = ({ featured }) => {
  const [idx, setIdx] = useState(0);
  const current = featured[idx];

  if (!current) return null;

  const prev = () => setIdx((i) => (i - 1 + featured.length) % featured.length);
  const next = () => setIdx((i) => (i + 1) % featured.length);

  return (
    <section aria-label="Featured events" className="relative overflow-hidden rounded-[16px] bg-[var(--paper-sunken)]">
      <div className="relative aspect-[21/9] sm:aspect-[16/7] w-full flex items-end p-6 sm:p-10">
        {/* Background poster banner with gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-1" />
        {current.posterUrl && (
          <img
            src={current.posterUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-105 opacity-40"
          />
        )}

        {/* Content */}
        <div className="relative z-2 flex items-end gap-6 w-full max-w-3xl">
          <div className="hidden sm:block shrink-0 w-28 aspect-[2/3] rounded-[8px] overflow-hidden shadow-lg border border-white/10">
            <Poster
              src={current.posterUrl}
              alt={current.title}
              className="w-full h-full"
            />
          </div>

          <div className="flex flex-col gap-2 text-white">
            <span className="text-caption text-white/70">FEATURED EVENT</span>
            <h2 className="font-display font-medium text-2xl sm:text-4xl leading-tight tracking-tight text-white">
              {current.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 flex items-center gap-1.5 flex-wrap">
              <Clock className="w-3.5 h-3.5" />
              {formatDay(current.nextScreening.startsAt)} · {formatTime(current.nextScreening.startsAt)}
              {' · '}{current.nextScreening.venue.name}
            </p>
            {current.minPrice && (
              <p className="text-sm text-white/70 tabular-nums">
                From {formatINR(current.minPrice)}
              </p>
            )}
            <Link
              to={`/events/${current.id}`}
              className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors self-start"
            >
              Book tickets
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Navigation arrows */}
        {featured.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous event"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--paper-raised)]/80 text-[var(--ink)] flex items-center justify-center hover:bg-[var(--paper-raised)] transition-colors cursor-pointer z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next event"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--paper-raised)]/80 text-[var(--ink)] flex items-center justify-center hover:bg-[var(--paper-raised)] transition-colors cursor-pointer z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {featured.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3">
          {featured.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all cursor-pointer ${
                i === idx
                  ? 'w-4 h-1.5 bg-[var(--accent)]'
                  : 'w-1.5 h-1.5 bg-[var(--rule-strong)] hover:bg-[var(--ink-faint)]'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// ---- Horizontal Scroll Row -----------------------------------------------

interface EventRowProps {
  title: string;
  events: CatalogCard[];
  seeAllHref: string;
}

const EventRow: React.FC<EventRowProps> = ({ title, events, seeAllHref }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const delta = direction === 'left' ? -320 : 320;
    scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (events.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-medium text-xl sm:text-2xl text-[var(--ink)] tracking-tight">
          {title}
        </h3>
        <div className="flex items-center gap-3">
          <Link
            to={seeAllHref}
            className="text-xs sm:text-sm font-medium text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            See all
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Desktop scroll arrows */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label={`Scroll ${title} left`}
              className="w-7 h-7 rounded-full border border-[var(--rule)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label={`Scroll ${title} right`}
              className="w-7 h-7 rounded-full border border-[var(--rule)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scroll canvas */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {events.map((event) => (
          <div
            key={event.id}
            className="shrink-0 w-36 sm:w-40"
            style={{ scrollSnapAlign: 'start' }}
          >
            <EventCard event={event} />
          </div>
        ))}
      </div>
    </section>
  );
};

// ---- Main HomePage -------------------------------------------------------

const CATEGORY_ORDER: ShowType[] = ['movie', 'concert', 'play', 'comedy', 'sports', 'other'];

export function HomePage() {
  const { city: currentCity, saveCity } = useCurrentCity();
  // SiteLayout only renders this page once a city is chosen.
  const city = currentCity!;
  const [showCityPicker, setShowCityPicker] = useState(false);

  const { data, isLoading, isError, refetch } = useGetHomeQuery(city);

  const featured = data?.featured ?? [];
  const weekend = data?.weekend;
  const sections = data?.sections ?? [];

  // Sort sections by canonical category order.
  const sortedSections: HomeSection[] = CATEGORY_ORDER
    .map((type) => sections.find((s) => s.type === type))
    .filter((s): s is HomeSection => Boolean(s));

  const isEmpty = !isLoading && !isError && featured.length === 0 && sections.length === 0;

  return (
    <div className="max-w-[var(--container-default)] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-12">
      {/* City header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--accent)]" />
          <h1
            className="font-display text-3xl sm:text-4xl font-medium text-[var(--ink)] tracking-tight"
            style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 40" }}
          >
            What's on in <span className="text-[var(--accent)]">{city}</span>
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

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-12">
          <div className="aspect-[21/9] sm:aspect-[16/7] rounded-[16px] bg-[var(--paper-sunken)] animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="shrink-0 w-36 sm:w-40 flex flex-col gap-2">
                <div className="w-full aspect-[2/3] rounded-[6px] bg-[var(--paper-sunken)] animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-[var(--paper-sunken)] animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-[var(--paper-sunken)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-16">
          <p className="text-[var(--ink-secondary)] mb-4">Couldn't load events. Check your connection.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty city */}
      {isEmpty && (
        <div className="text-center py-16 flex flex-col items-center gap-4">
          <MapPin className="w-12 h-12 text-[var(--ink-faint)]" />
          <h2 className="font-display text-2xl font-medium text-[var(--ink)]">
            Nothing on in {city} yet
          </h2>
          <p className="text-[var(--ink-secondary)] text-sm">
            Try a city with upcoming events or browse all available events.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCityPicker(true)}
              className="px-5 py-2.5 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              Change city
            </button>
            <Link
              to="/explore"
              className="px-5 py-2.5 rounded-[10px] border border-[var(--rule)] bg-[var(--paper-raised)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--paper-sunken)] transition-colors"
            >
              Explore all events
            </Link>
          </div>
        </div>
      )}

      {/* Hero carousel */}
      {!isLoading && !isError && featured.length > 0 && (
        <HeroCarousel featured={featured} />
      )}

      {/* Weekend row */}
      {!isLoading && !isError && weekend && weekend.events.length > 0 && (
        <EventRow
          title="This weekend"
          events={weekend.events}
          seeAllHref={`/explore?date=weekend`}
        />
      )}

      {/* Category rows */}
      {!isLoading && !isError && sortedSections.map((section) => (
        <EventRow
          key={section.type}
          title={SHOW_TYPE_LABELS[section.type]}
          events={section.events}
          seeAllHref={`/explore?type=${section.type}`}
        />
      ))}

      {/* Change city */}
      {showCityPicker && (
        <CityPicker
          mode="closable"
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
