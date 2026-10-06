import { Request, Response } from "express";
import { db } from "../config/db";
import { screeningPrices, screenings, screeningSeats, seats, shows, venues } from "../db/schema";
import { and, asc, count, desc, eq, exists, gt, gte, inArray, lt, min, sql } from "drizzle-orm";
import { homeQuerySchema, listCatalogQuerySchema } from "./catalogSchemas";
import { paginationMeta, sendValidationError } from "../utils/validation";
import { showIdParamSchema, showTypeValues } from "../Shows/showSchemas";
import { screeningIdParamSchema } from "../Screenings/screeningSchemas";
import { effectiveSeatStatus } from "../Screenings/screeningRules";

/*
 * Public catalog: what buyers can browse, signed out. Nothing here needs a
 * session, and every response is the same for everyone (who holds a seat is
 * never exposed; a buyer's own holds come from GET /screenings/:id/holds/me).
 *
 * Only published shows are visible. A draft, or a screening of one, is a 404,
 * the same "looks missing" rule the organizer endpoints use.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const getEvents = async (req: Request, res: Response) => {
    try {
        const parsed = listCatalogQuerySchema.safeParse(req.query)
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid query");

        const { city, date, type, page, pageSize } = parsed.data
        const now = new Date();

        const dayStart = date ? new Date(`${date}T00:00:00+05:30`) : undefined;
        const dayEnd = dayStart ? new Date(dayStart.getTime() + DAY_MS) : undefined;

        const bookableScreening = and(
            eq(screenings.status, "scheduled"),
            gt(screenings.startsAt, now),
            city ? sql`lower(${venues.city}) = lower(${city})` : undefined,
            dayStart ? gte(screenings.startsAt, dayStart) : undefined,
            dayEnd ? lt(screenings.startsAt, dayEnd) : undefined,
        );

        const where = and(
            eq(shows.status, "published"),
            type ? eq(shows.type, type) : undefined,
            exists(
                db.select({ one: sql`1` })
                    .from(screenings)
                    .innerJoin(venues, eq(screenings.venueId, venues.id))
                    .where(and(eq(screenings.showId, shows.id), bookableScreening)),
            ),
        );

        const [eventRows, total] = await Promise.all([
            db.select({
                id: shows.id,
                title: shows.title,
                type: shows.type,
                genre: shows.genre,
                language: shows.language,
                durationMinutes: shows.durationMinutes,
                ageRating: shows.ageRating,
                posterUrl: shows.posterUrl,
            })
                .from(shows)
                .where(where)
                .orderBy(desc(shows.publishedAt), desc(shows.id))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.$count(shows, where),
        ]);

        const ids = eventRows.map((e) => e.id);
        const extras = ids.length === 0 ? [] : await db.select({
            showId: screenings.showId,
            nextScreeningAt: min(screenings.startsAt),
            cities: sql<string[]>`array_agg(distinct ${venues.city})`,
            // Lowest price across the matching screenings, for "From ₹250".
            minPrice: min(screeningPrices.price),
        })
            .from(screenings)
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .leftJoin(screeningPrices, eq(screeningPrices.screeningId, screenings.id))
            .where(and(inArray(screenings.showId, ids), bookableScreening))
            .groupBy(screenings.showId);

        const byShow = new Map(extras.map((x) => [x.showId, x]));

        res.status(200).json({
            success: true,
            message: "Events fetched successfully",
            events: eventRows.map((e) => ({
                ...e,
                nextScreeningAt: byShow.get(e.id)?.nextScreeningAt ?? null,
                cities: byShow.get(e.id)?.cities ?? [],
                minPrice: byShow.get(e.id)?.minPrice ?? null,
            })),
            pagination: paginationMeta(parsed.data, total),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


/**
 * GET /api/catalog/events/:showId
 * One published event and its upcoming (scheduled, not yet started)
 * screenings, each with its venue, lowest price and seats still available.
 */
export const getEventById = async (req: Request, res: Response) => {
    try {
        const parsedParams = showIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid event id");

        const { showId } = parsedParams.data;

        const [event] = await db.select({
            id: shows.id,
            title: shows.title,
            description: shows.description,
            type: shows.type,
            genre: shows.genre,
            language: shows.language,
            durationMinutes: shows.durationMinutes,
            ageRating: shows.ageRating,
            posterUrl: shows.posterUrl,
        })
            .from(shows)
            .where(and(eq(shows.id, showId), eq(shows.status, "published")))
            .limit(1);
        if (!event) return res.status(404).json({ message: "Event not found" });

        const upcoming = await db.select({
            id: screenings.id,
            startsAt: screenings.startsAt,
            endsAt: screenings.endsAt,
            venue: { id: venues.id, name: venues.name, city: venues.city, address: venues.address },
        })
            .from(screenings)
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .where(and(
                eq(screenings.showId, showId),
                eq(screenings.status, "scheduled"),
                gt(screenings.startsAt, new Date()),
            ))
            .orderBy(asc(screenings.startsAt), asc(screenings.id));

        // Lowest price and free seats per screening: two grouped queries, not one per screening.
        const ids = upcoming.map((s) => s.id);
        const [priceRows, availabilityRows] = ids.length === 0 ? [[], []] : await Promise.all([
            db.select({ screeningId: screeningPrices.screeningId, minPrice: min(screeningPrices.price) })
                .from(screeningPrices)
                .where(inArray(screeningPrices.screeningId, ids))
                .groupBy(screeningPrices.screeningId),
            db.select({
                screeningId: screeningSeats.screeningId,
                available: sql<number>`count(*) filter (where ${effectiveSeatStatus()} = 'available')`.mapWith(Number),
                total: count(),
            })
                .from(screeningSeats)
                .where(inArray(screeningSeats.screeningId, ids))
                .groupBy(screeningSeats.screeningId),
        ]);

        const minPrice = new Map(priceRows.map((r) => [r.screeningId, r.minPrice]));
        const availability = new Map(availabilityRows.map((r) => [r.screeningId, r]));

        res.status(200).json({
            success: true,
            message: "Event fetched successfully",
            event: {
                ...event,
                screenings: upcoming.map((s) => ({
                    ...s,
                    minPrice: minPrice.get(s.id) ?? null,
                    seatsAvailable: availability.get(s.id)?.available ?? 0,
                    seatsTotal: availability.get(s.id)?.total ?? 0,
                })),
            },
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


/**
 * GET /api/catalog/screenings/:screeningId/seats
 * The seat map: every seat with its row, number, category, price and
 * effective status (an expired hold reads as available).
 *
 * A cancelled or started screening still returns its map, with
 * `bookable: false`, so the page can explain why rather than 404.
 */
export const getScreeningSeats = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id");

        const { screeningId } = parsedParams.data;

        const [row] = await db.select({
            screening: {
                id: screenings.id,
                startsAt: screenings.startsAt,
                endsAt: screenings.endsAt,
                status: screenings.status,
            },
            event: {
                id: shows.id,
                title: shows.title,
                durationMinutes: shows.durationMinutes,
                ageRating: shows.ageRating,
                posterUrl: shows.posterUrl,
            },
            venue: { id: venues.id, name: venues.name, city: venues.city, address: venues.address },
        })
            .from(screenings)
            .innerJoin(shows, eq(screenings.showId, shows.id))
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .where(and(eq(screenings.id, screeningId), eq(shows.status, "published")))
            .limit(1);
        if (!row) return res.status(404).json({ message: "Screening not found" });

        const [priceRows, seatRows] = await Promise.all([
            db.select({ category: screeningPrices.category, price: screeningPrices.price })
                .from(screeningPrices)
                .where(eq(screeningPrices.screeningId, screeningId)),
            db.select({
                id: screeningSeats.id,
                rowLabel: seats.rowLabel,
                seatNumber: seats.seatNumber,
                category: seats.category,
                price: screeningSeats.price,
                status: effectiveSeatStatus(),
            })
                .from(screeningSeats)
                .innerJoin(seats, eq(screeningSeats.seatId, seats.id))
                .where(eq(screeningSeats.screeningId, screeningId))
                // Same order as the venue layout: A…Z, AA…, then seat number.
                .orderBy(sql`length(${seats.rowLabel})`, asc(seats.rowLabel), asc(seats.seatNumber)),
        ]);

        const summary = { available: 0, held: 0, booked: 0, total: seatRows.length };
        for (const seat of seatRows) summary[seat.status]++;

        const bookable = row.screening.status === "scheduled" && row.screening.startsAt.getTime() > Date.now();

        res.status(200).json({
            success: true,
            message: "Seats fetched successfully",
            screening: { ...row.screening, bookable },
            event: row.event,
            venue: row.venue,
            prices: Object.fromEntries(priceRows.map((p) => [p.category, p.price])),
            seats: seatRows,
            summary,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


// ---------------------------------------------------------------------------
// City-first home (Frontend/docs/buyer-frontend-plan.md §0)
// ---------------------------------------------------------------------------

const HOME_FEATURED_LIMIT = 5;
const HOME_FEATURED_DAYS = 7;
const HOME_ROW_LIMIT = 12;

/** Today's date in India as YYYY-MM-DD. */
const istToday = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** Midnight IST at the start of `ymd` plus `days`. */
const istMidnight = (ymd: string, days = 0) =>
    new Date(new Date(`${ymd}T00:00:00+05:30`).getTime() + days * DAY_MS);

/**
 * "This weekend" in IST: Saturday 00:00 to Monday 00:00. On a Saturday or
 * Sunday it is the weekend already under way.
 */
const weekendRange = () => {
    const today = istToday();
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat (a calendar date, so UTC is fine)
    if (weekday === 6) return { start: istMidnight(today), end: istMidnight(today, 2) };
    if (weekday === 0) return { start: istMidnight(today, -1), end: istMidnight(today, 1) };
    const saturday = istMidnight(today, 6 - weekday);
    return { start: saturday, end: new Date(saturday.getTime() + 2 * DAY_MS) };
};

/** A published show's screening a buyer could book now. */
const bookableNow = (now: Date) => and(
    eq(shows.status, "published"),
    eq(screenings.status, "scheduled"),
    gt(screenings.startsAt, now),
);


/**
 * GET /api/catalog/cities
 * The city picker's list: every venue city with at least one bookable event,
 * most events first. Cities differing only in case ("bhavnagar", "Bhavnagar")
 * are one entry, matching how every catalog filter compares cities.
 */
export const getCities = async (_req: Request, res: Response) => {
    try {
        const eventCount = sql<number>`count(distinct ${shows.id})`.mapWith(Number);
        const cityName = sql<string>`min(${venues.city})`;

        const cities = await db.select({ city: cityName, eventCount })
            .from(screenings)
            .innerJoin(shows, eq(screenings.showId, shows.id))
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .where(bookableNow(new Date()))
            .groupBy(sql`lower(${venues.city})`)
            .orderBy(desc(eventCount), asc(cityName));

        res.status(200).json({ success: true, message: "Cities fetched successfully", cities });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


/**
 * GET /api/catalog/home?city=
 * The whole home page for one city in one request:
 * - featured: up to 5 events with the soonest showtimes in the next 7 days,
 *   each with that next showtime and its venue (the hero carousel)
 * - weekend: events with a showtime this Saturday or Sunday (IST)
 * - sections: one per event type that has events, each capped at 12, with a
 *   `total` for "See all"
 * Every list is ordered by the event's next showtime. Empty sections are left
 * out, so an empty city returns empty arrays and the page offers other cities.
 */
export const getHome = async (req: Request, res: Response) => {
    try {
        const parsed = homeQuerySchema.safeParse(req.query);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid query");

        const { city } = parsed.data;
        const now = new Date();
        const weekend = weekendRange();
        const inCity = sql`lower(${venues.city}) = lower(${city})`;
        const nextAt = min(screenings.startsAt);

        // One row per bookable event in the city. Grouping by the show's
        // primary key lets Postgres return the show's own columns.
        const rows = await db.select({
            id: shows.id,
            title: shows.title,
            type: shows.type,
            genre: shows.genre,
            language: shows.language,
            durationMinutes: shows.durationMinutes,
            ageRating: shows.ageRating,
            posterUrl: shows.posterUrl,
            nextScreeningAt: nextAt,
            minPrice: min(screeningPrices.price),
            thisWeekend: sql<boolean>`bool_or(${screenings.startsAt} >= ${weekend.start} and ${screenings.startsAt} < ${weekend.end})`,
        })
            .from(shows)
            .innerJoin(screenings, eq(screenings.showId, shows.id))
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .leftJoin(screeningPrices, eq(screeningPrices.screeningId, screenings.id))
            .where(and(bookableNow(now), inCity))
            .groupBy(shows.id)
            .orderBy(nextAt, asc(shows.id));

        const cards = rows.map(({ thisWeekend: _w, ...card }) => card);

        // Hero: the soonest showtimes in the next week, plus where each one is.
        const featuredCutoff = now.getTime() + HOME_FEATURED_DAYS * DAY_MS;
        const featuredCards = cards
            .filter((c) => c.nextScreeningAt && c.nextScreeningAt.getTime() < featuredCutoff)
            .slice(0, HOME_FEATURED_LIMIT);

        const featuredIds = featuredCards.map((c) => c.id);
        const nextShowtimes = featuredIds.length === 0 ? [] : await db
            .selectDistinctOn([screenings.showId], {
                showId: screenings.showId,
                id: screenings.id,
                startsAt: screenings.startsAt,
                venue: { id: venues.id, name: venues.name, city: venues.city },
            })
            .from(screenings)
            .innerJoin(shows, eq(screenings.showId, shows.id))
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .where(and(inArray(screenings.showId, featuredIds), bookableNow(now), inCity))
            .orderBy(screenings.showId, asc(screenings.startsAt), asc(screenings.id));
        const nextByShow = new Map(nextShowtimes.map(({ showId, ...next }) => [showId, next]));

        const weekendCards = cards.filter((_c, i) => rows[i].thisWeekend);

        res.status(200).json({
            success: true,
            message: "Home fetched successfully",
            city,
            featured: featuredCards.map((c) => ({ ...c, nextScreening: nextByShow.get(c.id) ?? null })),
            weekend: { total: weekendCards.length, events: weekendCards.slice(0, HOME_ROW_LIMIT) },
            sections: showTypeValues
                .map((type) => {
                    const ofType = cards.filter((c) => c.type === type);
                    return { type, total: ofType.length, events: ofType.slice(0, HOME_ROW_LIMIT) };
                })
                .filter((section) => section.total > 0),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
