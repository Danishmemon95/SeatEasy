import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { screenings, screeningSeats, seats, shows } from "../db/schema";
import { HttpError } from "../utils/httpError";
import { liveHold, type Tx } from "../Screenings/screeningRules";

/*
 * Rules shared by the holds and bookings modules.
 *
 * Locking order for buyer writes, always the same so two transactions never
 * wait on each other in opposite orders:
 *   buyer lock (advisory) → bookings → screening (share) → screening_seats (by id)
 * Any step may be skipped, but never reordered. Paying takes no buyer lock and
 * starts at its booking row.
 *
 * Expiry is lazy (see liveHold): nothing ever sweeps old holds.
 */

/**
 * Serialises one buyer's hold and booking writes for one screening, so two
 * tabs can't both pass the "at most 10 seats" check. A transaction-scoped
 * advisory lock: released automatically on commit or rollback, and it doesn't
 * block other buyers at all.
 */
export const lockBuyerScreening = async (tx: Tx, userId: number, screeningId: number) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::int, ${screeningId}::int)`);
};

/**
 * Locks the screening (share: it blocks an organizer cancel or edit until this
 * transaction ends, but not other buyers) and checks that it can be booked:
 * its show is published, it is scheduled, and it hasn't started.
 */
export const lockBookableScreening = async (tx: Tx, screeningId: number) => {
    const [screening] = await tx
        .select({ id: screenings.id, status: screenings.status, startsAt: screenings.startsAt, showStatus: shows.status })
        .from(screenings)
        .innerJoin(shows, eq(screenings.showId, shows.id))
        .where(eq(screenings.id, screeningId))
        .for("share", { of: screenings });

    // A draft show's screening looks missing, as in the public catalog.
    if (!screening || screening.showStatus !== "published") throw new HttpError(404, "Screening not found");
    if (screening.status === "cancelled") throw new HttpError(409, "This screening has been cancelled");
    if (screening.startsAt.getTime() <= Date.now()) throw new HttpError(409, "This screening has already started");
    return screening;
};

/** Sums decimal strings ("250.00") exactly, in paise, and returns "1234.50". */
export const sumPrices = (prices: string[]) => {
    const paise = prices.reduce((total, p) => total + Math.round(Number(p) * 100), 0);
    return (paise / 100).toFixed(2);
};

/**
 * The buyer's live holds on a screening: the seats, one shared expiry, and
 * the total. Every hold the buyer has on a screening shares one window, so
 * heldUntil is the same on each row.
 */
export const loadMyHolds = async (executor: Tx | typeof db, userId: number, screeningId: number) => {
    const rows = await executor
        .select({
            id: screeningSeats.id,
            rowLabel: seats.rowLabel,
            seatNumber: seats.seatNumber,
            category: seats.category,
            price: screeningSeats.price,
            heldUntil: screeningSeats.heldUntil,
        })
        .from(screeningSeats)
        .innerJoin(seats, eq(screeningSeats.seatId, seats.id))
        .where(and(
            eq(screeningSeats.screeningId, screeningId),
            eq(screeningSeats.heldBy, userId),
            liveHold(),
        ))
        .orderBy(sql`length(${seats.rowLabel})`, asc(seats.rowLabel), asc(seats.seatNumber));

    return {
        screeningId,
        heldUntil: rows[0]?.heldUntil ?? null,
        seats: rows.map(({ heldUntil: _heldUntil, ...seat }) => seat),
        total: sumPrices(rows.map((r) => r.price)),
    };
};
