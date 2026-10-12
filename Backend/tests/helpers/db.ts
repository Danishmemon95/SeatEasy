import { eq, sql } from "drizzle-orm";
import pool, { db } from "../../src/config/db";
import { bookings, screeningSeats } from "../../src/db/schema";
import { assertTestDatabase } from "./guard";

assertTestDatabase();

/** Empties every table and restarts the ids, so each test starts clean. */
export const resetDb = async () => {
    await db.execute(sql`
        TRUNCATE users, venues, seats, shows, screenings, screening_prices,
                 bookings, screening_seats, org_applications
        RESTART IDENTITY CASCADE
    `);
};

export const closeDb = () => pool.end();

/**
 * Expiry reads the database clock, so tests move the data rather than the
 * clock: this pushes a buyer's holds on a screening into the past.
 */
export const expireHolds = async (userId: number, screeningId: number, secondsAgo = 1) => {
    await db.execute(sql`
        UPDATE screening_seats
        SET held_until = now() - ${secondsAgo}::int * interval '1 second'
        WHERE screening_id = ${screeningId} AND held_by = ${userId} AND status = 'held'
    `);
};

/** Moves a screening's start into the past, as if it had begun. */
export const startScreening = async (screeningId: number) => {
    await db.execute(sql`
        UPDATE screenings
        SET starts_at = now() - interval '1 minute', ends_at = now() + interval '2 hours'
        WHERE id = ${screeningId}
    `);
};

export const cancelScreeningRow = async (screeningId: number) => {
    await db.execute(sql`UPDATE screenings SET status = 'cancelled', cancelled_at = now() WHERE id = ${screeningId}`);
};

/** The raw screening_seats rows (not the effective status), ordered by id. */
export const seatRows = (screeningId: number) =>
    db.select().from(screeningSeats).where(eq(screeningSeats.screeningId, screeningId)).orderBy(screeningSeats.id);

export const seatRow = async (id: number) =>
    (await db.select().from(screeningSeats).where(eq(screeningSeats.id, id)))[0];

export const bookingRow = async (id: number) =>
    (await db.select().from(bookings).where(eq(bookings.id, id)))[0];

/** Seat ids a user holds right now (live holds only). */
export const liveHeldIds = async (userId: number, screeningId: number): Promise<number[]> => {
    const result = await db.execute<{ id: number }>(sql`
        SELECT id FROM screening_seats
        WHERE screening_id = ${screeningId} AND held_by = ${userId}
          AND status = 'held' AND held_until > now()
        ORDER BY id
    `);
    return result.rows.map((r) => r.id);
};

/**
 * The rules that must hold whatever order requests ran in. Called at the end
 * of the race tests, where the status codes alone can't prove consistency.
 */
export const inventoryProblems = async (screeningId: number): Promise<string[]> => {
    const result = await db.execute<{ problem: string }>(sql`
        SELECT 'seat ' || s.id || ': available but still carries hold or booking fields' AS problem
        FROM screening_seats s
        WHERE s.screening_id = ${screeningId} AND s.status = 'available'
          AND (s.held_by IS NOT NULL OR s.held_until IS NOT NULL OR s.booking_id IS NOT NULL)
        UNION ALL
        SELECT 'seat ' || s.id || ': held without an owner or an expiry'
        FROM screening_seats s
        WHERE s.screening_id = ${screeningId} AND s.status = 'held'
          AND (s.held_by IS NULL OR s.held_until IS NULL)
        UNION ALL
        SELECT 'seat ' || s.id || ': booked without a confirmed booking'
        FROM screening_seats s
        LEFT JOIN bookings b ON b.id = s.booking_id
        WHERE s.screening_id = ${screeningId} AND s.status = 'booked'
          AND (b.id IS NULL OR b.status <> 'confirmed')
        UNION ALL
        SELECT 'booking ' || b.id || ': confirmed, but its seats are not all booked or do not add up to the total'
        FROM bookings b
        LEFT JOIN screening_seats s ON s.booking_id = b.id
        WHERE b.screening_id = ${screeningId} AND b.status = 'confirmed'
        GROUP BY b.id, b.total_amount
        HAVING count(s.id) = 0
            OR bool_or(s.status <> 'booked')
            OR coalesce(sum(s.price), 0) <> b.total_amount
    `);
    return result.rows.map((r) => r.problem);
};
