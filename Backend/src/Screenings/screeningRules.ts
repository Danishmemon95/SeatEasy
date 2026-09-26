import { and, eq, gt, inArray, lt, ne, type SQL } from "drizzle-orm";
import { db } from "../config/db";
import { screenings, screeningSeats, shows, venues } from "../db/schema";

/**
 * Scheduling rules shared by the screening and seat modules.
 *
 * Locking convention: any write that depends on a venue's schedule or seat
 * layout runs in a transaction that first locks the venue row (lockVenue).
 * Writes for the same venue then run one after another, so a check such as
 * "no overlapping screening" or "no upcoming screening" can't go stale before
 * the write that relies on it. When several rows are locked, the order is
 * always show → venue(s, by id) → screening, so two transactions never wait on
 * each other in opposite orders (deadlock).
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SCREENING_BUFFER_MINUTES = 15;

const MINUTE_MS = 60 * 1000;

export const screeningEndsAt = (startsAt: Date, durationMinutes: number) =>
    new Date(startsAt.getTime() + durationMinutes * MINUTE_MS);

/**
 * Locks a show row and returns it, or undefined if it doesn't exist or `scope`
 * excludes it.
 *
 * "update" for writes to the show itself (edit, delete). "share" when adding
 * or moving a screening: it still blocks a concurrent duration change or
 * delete, but lets screenings for the same show be created side by side.
 */
export const lockShow = async (tx: Tx, showId: number, scope?: SQL, strength: "update" | "share" = "update") => {
    const [show] = await tx
        .select()
        .from(shows)
        .where(and(eq(shows.id, showId), scope))
        .for(strength);
    return show;
};

/**
 * Locks a venue row for the rest of the transaction and returns it, or
 * undefined if it doesn't exist or `scope` excludes it.
 */
export const lockVenue = async (tx: Tx, venueId: number, scope?: SQL) => {
    const [venue] = await tx
        .select({ id: venues.id, ownerId: venues.ownerId })
        .from(venues)
        .where(and(eq(venues.id, venueId), scope))
        .for("update");
    return venue;
};

/** Whether the venue has a non-cancelled screening that hasn't ended yet. */
export const hasUpcomingScreenings = async (tx: Tx, venueId: number) => {
    const [upcoming] = await tx
        .select({ id: screenings.id })
        .from(screenings)
        .where(and(
            eq(screenings.venueId, venueId),
            eq(screenings.status, "scheduled"),
            gt(screenings.endsAt, new Date()),
        ))
        .limit(1);
    return Boolean(upcoming);
};

/**
 * The first non-cancelled screening at the venue that would clash with the
 * given time slot, allowing for the changeover buffer on both sides:
 * other.start < new.end + buffer AND new.start < other.end + buffer.
 */
export const findOverlappingScreening = async (
    tx: Tx,
    { venueId, startsAt, endsAt, excludeScreeningId }: {
        venueId: number;
        startsAt: Date;
        endsAt: Date;
        excludeScreeningId?: number;
    },
) => {
    const buffer = SCREENING_BUFFER_MINUTES * MINUTE_MS;
    const [clash] = await tx
        .select({ id: screenings.id, startsAt: screenings.startsAt, endsAt: screenings.endsAt })
        .from(screenings)
        .where(and(
            eq(screenings.venueId, venueId),
            eq(screenings.status, "scheduled"),
            lt(screenings.startsAt, new Date(endsAt.getTime() + buffer)),
            gt(screenings.endsAt, new Date(startsAt.getTime() - buffer)),
            excludeScreeningId === undefined ? undefined : ne(screenings.id, excludeScreeningId),
        ))
        .limit(1);
    return clash;
};

/**
 * Whether any seat in the given screenings is held or booked. Expired holds
 * still count until the booking module adds hold expiry — the conservative
 * choice, since releasing them is that module's job.
 */
export const hasSoldSeats = async (tx: Tx, screeningIds: number[]) => {
    if (screeningIds.length === 0) return false;
    const [sold] = await tx
        .select({ id: screeningSeats.id })
        .from(screeningSeats)
        .where(and(
            inArray(screeningSeats.screeningId, screeningIds),
            inArray(screeningSeats.status, ["held", "booked"]),
        ))
        .limit(1);
    return Boolean(sold);
};
