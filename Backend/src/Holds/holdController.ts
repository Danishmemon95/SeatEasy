import { Request, Response } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db";
import { bookings, screeningSeats } from "../db/schema";
import { HttpError } from "../utils/httpError";
import { sendValidationError } from "../utils/validation";
import { screeningIdParamSchema } from "../Screenings/screeningSchemas";
import { effectiveSeatStatus, HOLD_MINUTES, liveHold, MAX_HELD_SEATS } from "../Screenings/screeningRules";
import { holdSeatsSchema } from "./holdSchemas";
import { loadMyHolds, lockBookableScreening, lockBuyerScreening } from "./holdRules";

/*
 * Seat holds: a buyer reserves seats for HOLD_MINUTES while they check out.
 *
 * A hold is all-or-nothing: if any requested seat is taken, nothing is held
 * and the 409 lists the taken ids, so the page can suggest alternatives.
 *
 * One hold window per buyer per screening. Adding seats joins the existing
 * window instead of restarting it, so a buyer can't keep seats forever by
 * re-holding every few minutes.
 */

const handleError = (error: unknown, res: Response) => {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
    console.error(error)
    return res.status(500).json({ message: "Internal server error" })
}

type HoldOutcome =
    | { kind: "held"; holds: Awaited<ReturnType<typeof loadMyHolds>> }
    | { kind: "unknown"; ids: number[] }
    | { kind: "unavailable"; ids: number[] }
    | { kind: "limit"; wouldHold: number }

/** POST /api/screenings/:screeningId/holds  { seatIds } */
export const holdSeats = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const parsed = holdSeatsSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid seats")

        const { screeningId } = parsedParams.data
        const { seatIds } = parsed.data
        const userId = req.user!.id

        const outcome = await db.transaction(async (tx): Promise<HoldOutcome> => {
            await lockBuyerScreening(tx, userId, screeningId)
            await lockBookableScreening(tx, screeningId)

            // Lock the requested rows in id order. Every buyer locks in the
            // same order, so two overlapping requests queue instead of
            // deadlocking, and only one of them can see a seat as free.
            const rows = await tx
                .select({ id: screeningSeats.id, status: effectiveSeatStatus(), heldBy: screeningSeats.heldBy })
                .from(screeningSeats)
                .where(and(eq(screeningSeats.screeningId, screeningId), inArray(screeningSeats.id, seatIds)))
                .orderBy(asc(screeningSeats.id))
                .for("update")

            // Nothing has been written yet, so returning (and committing) is safe.
            const found = new Set(rows.map((r) => r.id))
            const unknown = seatIds.filter((id) => !found.has(id))
            if (unknown.length > 0) return { kind: "unknown", ids: unknown }

            const isMine = (r: (typeof rows)[number]) => r.status === "held" && r.heldBy === userId
            const unavailable = rows.filter((r) => r.status !== "available" && !isMine(r)).map((r) => r.id)
            if (unavailable.length > 0) return { kind: "unavailable", ids: unavailable }

            // Seats already in this buyer's live hold, requested or not.
            const current = await tx
                .select({ id: screeningSeats.id, heldUntil: screeningSeats.heldUntil })
                .from(screeningSeats)
                .where(and(eq(screeningSeats.screeningId, screeningId), eq(screeningSeats.heldBy, userId), liveHold()))

            const toHold = rows.filter((r) => !isMine(r)).map((r) => r.id)
            const wouldHold = current.length + toHold.length
            if (wouldHold > MAX_HELD_SEATS) return { kind: "limit", wouldHold }

            if (toHold.length > 0) {
                // Join the existing window if there is one; otherwise start a new
                // one on the database clock (the same clock liveHold() reads).
                const heldUntil = current[0]?.heldUntil
                    ?? sql`now() + ${HOLD_MINUTES}::int * interval '1 minute'`

                await tx.update(screeningSeats)
                    .set({
                        status: "held",
                        heldBy: userId,
                        heldUntil,
                        // A stale link from an abandoned checkout must not carry over.
                        bookingId: null,
                        updatedAt: new Date(),
                    })
                    .where(inArray(screeningSeats.id, toHold))
            }

            return { kind: "held", holds: await loadMyHolds(tx, userId, screeningId) }
        })

        switch (outcome.kind) {
            case "unknown":
                return res.status(400).json({ message: "Some seats don't belong to this screening", unknown: outcome.ids })
            case "unavailable":
                return res.status(409).json({ message: "Some of these seats were just taken", unavailable: outcome.ids })
            case "limit":
                return res.status(409).json({
                    message: `You can hold at most ${MAX_HELD_SEATS} seats for a screening (this would make ${outcome.wouldHold})`,
                })
            case "held":
                return res.status(200).json({ success: true, message: "Seats held", ...outcome.holds })
        }

    } catch (error) {
        handleError(error, res)
    }
}


/**
 * DELETE /api/screenings/:screeningId/holds
 * Releases all of the buyer's holds on the screening, and cancels a pending
 * booking made from them (its seats are gone, so it can no longer be paid).
 */
export const releaseHolds = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const { screeningId } = parsedParams.data
        const userId = req.user!.id

        const released = await db.transaction(async (tx) => {
            await lockBuyerScreening(tx, userId, screeningId)

            // Bookings before seats: paying locks the booking, then its seats,
            // so every transaction touching both takes them in that order.
            await tx.update(bookings)
                .set({ status: "cancelled", updatedAt: new Date() })
                .where(and(
                    eq(bookings.userId, userId),
                    eq(bookings.screeningId, screeningId),
                    eq(bookings.status, "pending"),
                ))

            // Expired holds too: they read as available anyway, and clearing them keeps the rows tidy.
            const rows = await tx.update(screeningSeats)
                .set({ status: "available", heldBy: null, heldUntil: null, bookingId: null, updatedAt: new Date() })
                .where(and(
                    eq(screeningSeats.screeningId, screeningId),
                    eq(screeningSeats.heldBy, userId),
                    eq(screeningSeats.status, "held"),
                ))
                .returning({ id: screeningSeats.id })

            return rows.length
        })

        res.status(200).json({ success: true, message: released > 0 ? "Seats released" : "No seats to release", released })

    } catch (error) {
        handleError(error, res)
    }
}


/**
 * GET /api/screenings/:screeningId/holds/me
 * The buyer's live holds and their shared expiry, so a refreshed page can
 * resume the countdown. An empty hold is a 200 with no seats, not a 404.
 */
export const getMyHolds = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const holds = await loadMyHolds(db, req.user!.id, parsedParams.data.screeningId)
        res.status(200).json({ success: true, message: "Holds fetched successfully", ...holds })

    } catch (error) {
        handleError(error, res)
    }
}
