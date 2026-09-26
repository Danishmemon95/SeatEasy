import { Request, Response } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db";
import { seats, venues } from "../db/schema";
import {
    addSeatRowsSchema,
    seatCategoryValues,
    seatParamSchema,
    seatRowParamSchema,
    updateSeatSchema,
    venueSeatsParamSchema,
} from "./seatSchemas";
import { hasPgErrorCode, PG_FOREIGN_KEY_VIOLATION, PG_UNIQUE_VIOLATION } from "../utils/pgErrors";
import { ownerScope, type AuthedUser } from "../utils/access";
import { HttpError } from "../utils/httpError";
import { sendValidationError } from "../utils/validation";
import { hasUpcomingScreenings, lockVenue, type Tx } from "../Screenings/screeningRules";

const LAYOUT_LOCKED = "This venue has upcoming screenings, so its seat layout can't change";

/**
 * Every layout change starts here: lock the venue (so a screening can't be
 * created mid-change), confirm the user may manage it, and refuse while any
 * upcoming screening depends on the current layout.
 */
const lockVenueForLayoutChange = async (tx: Tx, venueId: number, user: AuthedUser) => {
    const venue = await lockVenue(tx, venueId, ownerScope(venues.ownerId, user))
    if (!venue) throw new HttpError(404, "Venue not found")
    if (await hasUpcomingScreenings(tx, venueId)) throw new HttpError(409, LAYOUT_LOCKED)
}


export const getSeats = async (req: Request, res: Response) => {
    try {
        const parsedParams = venueSeatsParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid venue id")

        const { venueId } = parsedParams.data

        const [venue] = await db.select({ id: venues.id }).from(venues)
            .where(and(eq(venues.id, venueId), ownerScope(venues.ownerId, req.user!)))
            .limit(1)
        if (!venue) return res.status(404).json({ message: "Venue not found" })

        // Ordering by label length first keeps "AA" after "Z" instead of between "A" and "B".
        const seatList = await db.select().from(seats)
            .where(eq(seats.venueId, venueId))
            .orderBy(sql`length(${seats.rowLabel})`, asc(seats.rowLabel), asc(seats.seatNumber))

        // Per-category counts, derived from the seats themselves so they can never drift.
        const summary = Object.fromEntries(seatCategoryValues.map((c) => [c, 0])) as Record<(typeof seatCategoryValues)[number], number>
        for (const seat of seatList) summary[seat.category]++

        res.status(200).json({
            success: true,
            message: "Seats fetched successfully",
            seats: seatList,
            summary: { ...summary, total: seatList.length },
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const addSeatRows = async (req: Request, res: Response) => {
    try {
        const parsedParams = venueSeatsParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid venue id")

        const parsed = addSeatRowsSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid seat layout")

        const { venueId } = parsedParams.data
        const { rows } = parsed.data

        const created = await db.transaction(async (tx) => {
            await lockVenueForLayoutChange(tx, venueId, req.user!)

            // Checked up front only to name the clashing rows in the response.
            // The unique constraint is what actually prevents duplicates.
            const existingRows = await tx.selectDistinct({ rowLabel: seats.rowLabel }).from(seats)
                .where(and(eq(seats.venueId, venueId), inArray(seats.rowLabel, rows.map((r) => r.row))))

            if (existingRows.length > 0) {
                throw new HttpError(409, `Row(s) already exist in this venue: ${existingRows.map((r) => r.rowLabel).join(", ")}`)
            }

            // Expand each row description into its individual seats: A1, A2, ... A10.
            const newSeats = rows.flatMap((r) =>
                Array.from({ length: r.seats }, (_, i) => ({
                    venueId,
                    rowLabel: r.row,
                    seatNumber: i + 1,
                    category: r.category,
                })),
            )

            return tx.insert(seats).values(newSeats).returning()
        })

        res.status(201).json({ success: true, message: `${created.length} seats created`, seats: created })

    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
        if (hasPgErrorCode(error, PG_UNIQUE_VIOLATION)) {
            return res.status(409).json({ message: "One or more of these rows already exist in this venue" })
        }
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const updateSeat = async (req: Request, res: Response) => {
    try {
        const parsedParams = seatParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid seat")

        const parsed = updateSeatSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid seat details")

        const { venueId, seatId } = parsedParams.data

        const seat = await db.transaction(async (tx) => {
            await lockVenueForLayoutChange(tx, venueId, req.user!)

            // Matching on venueId too, so a seat id from another venue is a 404
            // rather than silently editing a seat the URL doesn't point at.
            const [updated] = await tx.update(seats)
                .set({ category: parsed.data.category, updatedAt: new Date() })
                .where(and(eq(seats.id, seatId), eq(seats.venueId, venueId)))
                .returning()

            if (!updated) throw new HttpError(404, "Seat not found")
            return updated
        })

        res.status(200).json({ success: true, message: "Seat updated", seat })

    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const deleteSeat = async (req: Request, res: Response) => {
    try {
        const parsedParams = seatParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid seat")

        const { venueId, seatId } = parsedParams.data

        const seat = await db.transaction(async (tx) => {
            await lockVenueForLayoutChange(tx, venueId, req.user!)

            const [deleted] = await tx.delete(seats)
                .where(and(eq(seats.id, seatId), eq(seats.venueId, venueId)))
                .returning()

            if (!deleted) throw new HttpError(404, "Seat not found")
            return deleted
        })

        res.status(200).json({ success: true, message: "Seat deleted", seat })

    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
        // Past screenings still reference their seats; that history is kept.
        if (hasPgErrorCode(error, PG_FOREIGN_KEY_VIOLATION)) {
            return res.status(409).json({ message: "This seat is part of a past screening and cannot be deleted" })
        }
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const deleteSeatRow = async (req: Request, res: Response) => {
    try {
        const parsedParams = seatRowParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid row")

        const { venueId, row } = parsedParams.data

        const deletedCount = await db.transaction(async (tx) => {
            await lockVenueForLayoutChange(tx, venueId, req.user!)

            // One statement, so the row is removed entirely or not at all.
            const deleted = await tx.delete(seats)
                .where(and(eq(seats.venueId, venueId), eq(seats.rowLabel, row)))
                .returning({ id: seats.id })

            if (deleted.length === 0) throw new HttpError(404, `Row ${row} not found`)
            return deleted.length
        })

        res.status(200).json({ success: true, message: `Row ${row} deleted (${deletedCount} seats)` })

    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
        if (hasPgErrorCode(error, PG_FOREIGN_KEY_VIOLATION)) {
            return res.status(409).json({ message: "Seats in this row are part of a past screening and cannot be deleted" })
        }
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}
