import { Request, Response } from "express";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../config/db";
import { bookings, screenings, screeningSeats, seats, shows, venues } from "../db/schema";
import { HttpError } from "../utils/httpError";
import { paginationMeta, sendValidationError } from "../utils/validation";
import { effectiveSeatStatus, liveHold } from "../Screenings/screeningRules";
import { lockBookableScreening, lockBuyerScreening, sumPrices } from "../Holds/holdRules";
import { bookingIdParamSchema, createBookingSchema, listMyBookingsQuerySchema } from "./bookingSchemas";

/*
 * Bookings, with a mock payment step:
 *
 *   holds ──POST /bookings──► pending booking ──POST /bookings/:id/pay──► confirmed
 *                                   │                                        │
 *                 hold expires,     └──► cancelled (seats released)          ▼
 *                 or screening                                     seats status = booked
 *                 cancelled/started                               (the rows ARE the tickets)
 *
 * A booking is for one screening. Its seats are the screening_seats rows whose
 * booking_id points at it. Every booking belongs to one user, and another
 * user's booking is a 404, never a 403.
 *
 * Decisions (see docs/buyer-flow-plan.md §4.3):
 * - An abandoned pending booking needs no cleanup: its holds expire like any
 *   other, and paying it later fails and cancels it.
 * - If the organizer cancels the screening, confirmed bookings stay confirmed
 *   and show the screening as cancelled. Refunds are out of scope.
 */

const handleError = (error: unknown, res: Response) => {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
    console.error(error)
    return res.status(500).json({ message: "Internal server error" })
}

/**
 * Bookings matching `where`, newest first, each with its screening, event,
 * venue and seats. Two queries in total, whatever the page size.
 */
const loadBookings = async (where: SQL | undefined, page?: { limit: number; offset: number }) => {
    const base = db.select({
        id: bookings.id,
        status: bookings.status,
        totalAmount: bookings.totalAmount,
        createdAt: bookings.createdAt,
        confirmedAt: bookings.confirmedAt,
        screening: {
            id: screenings.id,
            startsAt: screenings.startsAt,
            endsAt: screenings.endsAt,
            status: screenings.status,
        },
        event: { id: shows.id, title: shows.title, posterUrl: shows.posterUrl, ageRating: shows.ageRating },
        venue: { id: venues.id, name: venues.name, city: venues.city, address: venues.address },
    })
        .from(bookings)
        .innerJoin(screenings, eq(bookings.screeningId, screenings.id))
        .innerJoin(shows, eq(screenings.showId, shows.id))
        .innerJoin(venues, eq(screenings.venueId, venues.id))
        .where(where)
        .orderBy(desc(bookings.createdAt), desc(bookings.id))

    const rows = page ? await base.limit(page.limit).offset(page.offset) : await base

    const ids = rows.map((r) => r.id)
    const seatRows = ids.length === 0 ? [] : await db.select({
        bookingId: screeningSeats.bookingId,
        id: screeningSeats.id,
        rowLabel: seats.rowLabel,
        seatNumber: seats.seatNumber,
        category: seats.category,
        price: screeningSeats.price,
    })
        .from(screeningSeats)
        .innerJoin(seats, eq(screeningSeats.seatId, seats.id))
        .where(inArray(screeningSeats.bookingId, ids))
        .orderBy(sql`length(${seats.rowLabel})`, asc(seats.rowLabel), asc(seats.seatNumber))

    const seatsByBooking = new Map<number, Omit<(typeof seatRows)[number], "bookingId">[]>()
    for (const { bookingId, ...seat } of seatRows) {
        const list = seatsByBooking.get(bookingId!) ?? []
        list.push(seat)
        seatsByBooking.set(bookingId!, list)
    }

    // A cancelled booking has no seats: they were released back to the screening.
    return rows.map((r) => ({ ...r, seats: seatsByBooking.get(r.id) ?? [] }))
}

const loadBooking = async (bookingId: number, userId: number) =>
    (await loadBookings(and(eq(bookings.id, bookingId), eq(bookings.userId, userId))))[0]


/**
 * POST /api/bookings  { screeningId }
 * Turns the caller's live holds on the screening into one pending booking.
 * Checking out again replaces an earlier pending booking for the same
 * screening, so a double click or a second tab can't leave two.
 */
export const createBooking = async (req: Request, res: Response) => {
    try {
        const parsed = createBookingSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid booking")

        const { screeningId } = parsed.data
        const userId = req.user!.id

        const bookingId = await db.transaction(async (tx) => {
            // Lock order: buyer → bookings → screening → seats (holdRules.ts).
            await lockBuyerScreening(tx, userId, screeningId)

            const earlier = await tx.select({ id: bookings.id }).from(bookings)
                .where(and(
                    eq(bookings.userId, userId),
                    eq(bookings.screeningId, screeningId),
                    eq(bookings.status, "pending"),
                ))
                .orderBy(asc(bookings.id))
                .for("update")

            await lockBookableScreening(tx, screeningId)

            const held = await tx.select({ id: screeningSeats.id, price: screeningSeats.price })
                .from(screeningSeats)
                .where(and(eq(screeningSeats.screeningId, screeningId), eq(screeningSeats.heldBy, userId), liveHold()))
                .orderBy(asc(screeningSeats.id))
                .for("update")

            if (held.length === 0) {
                throw new HttpError(409, "You have no seats held for this screening, or your hold expired. Please choose your seats again.")
            }

            if (earlier.length > 0) {
                await tx.update(bookings)
                    .set({ status: "cancelled", updatedAt: new Date() })
                    .where(inArray(bookings.id, earlier.map((b) => b.id)))
            }

            const [booking] = await tx.insert(bookings).values({
                userId,
                screeningId,
                status: "pending",
                // Priced from the inventory, never from the request.
                totalAmount: sumPrices(held.map((s) => s.price)),
            }).returning({ id: bookings.id })

            await tx.update(screeningSeats)
                .set({ bookingId: booking.id, updatedAt: new Date() })
                .where(inArray(screeningSeats.id, held.map((s) => s.id)))

            return booking.id
        })

        res.status(201).json({ success: true, message: "Booking created", booking: await loadBooking(bookingId, userId) })

    } catch (error) {
        handleError(error, res)
    }
}


type PayOutcome = { kind: "paid" } | { kind: "failed"; message: string }

/**
 * POST /api/bookings/:bookingId/pay
 * Mock payment. Succeeds only while every seat is still under the caller's
 * live hold and the screening is still bookable. Otherwise the booking is
 * cancelled and its seats released, and that outcome is committed before the
 * 409, so a failed payment leaves nothing half-done.
 */
export const payBooking = async (req: Request, res: Response) => {
    try {
        const parsedParams = bookingIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid booking id")

        const { bookingId } = parsedParams.data
        const userId = req.user!.id

        const outcome = await db.transaction(async (tx): Promise<PayOutcome> => {
            // Lock order: booking → screening → seats. Two pay requests for one booking queue here.
            const [booking] = await tx.select({
                id: bookings.id,
                status: bookings.status,
                screeningId: bookings.screeningId,
                totalAmount: bookings.totalAmount,
            })
                .from(bookings)
                .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
                .for("update")

            if (!booking) throw new HttpError(404, "Booking not found")
            if (booking.status === "confirmed") throw new HttpError(409, "This booking is already paid")
            if (booking.status === "cancelled") {
                throw new HttpError(409, "This booking was cancelled. Please choose your seats again.")
            }

            const [screening] = await tx.select({ status: screenings.status, startsAt: screenings.startsAt })
                .from(screenings)
                .where(eq(screenings.id, booking.screeningId))
                .for("share")

            const rows = await tx.select({
                id: screeningSeats.id,
                status: effectiveSeatStatus(),
                heldBy: screeningSeats.heldBy,
                price: screeningSeats.price,
            })
                .from(screeningSeats)
                .where(eq(screeningSeats.bookingId, bookingId))
                .orderBy(asc(screeningSeats.id))
                .for("update")

            let failure: string | null = null
            if (screening.status === "cancelled") {
                failure = "This screening has been cancelled, so the booking can't be paid."
            } else if (screening.startsAt.getTime() <= Date.now()) {
                failure = "This screening has already started, so the booking can't be paid."
            } else if (
                rows.length === 0
                || rows.some((r) => r.status !== "held" || r.heldBy !== userId)
                // A seat lost since checkout would make the total wrong.
                || sumPrices(rows.map((r) => r.price)) !== Number(booking.totalAmount).toFixed(2)
            ) {
                failure = "Your hold expired, so the seats were released. Please choose your seats again."
            }

            if (failure) {
                await tx.update(bookings)
                    .set({ status: "cancelled", updatedAt: new Date() })
                    .where(eq(bookings.id, bookingId))
                // Release only rows still held by this buyer; a re-held seat already belongs to someone else.
                await tx.update(screeningSeats)
                    .set({ status: "available", heldBy: null, heldUntil: null, bookingId: null, updatedAt: new Date() })
                    .where(and(
                        eq(screeningSeats.bookingId, bookingId),
                        eq(screeningSeats.heldBy, userId),
                        eq(screeningSeats.status, "held"),
                    ))
                return { kind: "failed", message: failure }
            }

            // The rows become the tickets: booked, linked to the booking, no longer a hold.
            await tx.update(screeningSeats)
                .set({ status: "booked", heldBy: null, heldUntil: null, updatedAt: new Date() })
                .where(eq(screeningSeats.bookingId, bookingId))

            await tx.update(bookings)
                .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
                .where(eq(bookings.id, bookingId))

            return { kind: "paid" }
        })

        if (outcome.kind === "failed") return res.status(409).json({ message: outcome.message })

        res.status(200).json({ success: true, message: "Booking confirmed", booking: await loadBooking(bookingId, userId) })

    } catch (error) {
        handleError(error, res)
    }
}


/** GET /api/bookings/me?page&pageSize&status, newest first. */
export const getMyBookings = async (req: Request, res: Response) => {
    try {
        const parsed = listMyBookingsQuerySchema.safeParse(req.query);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid query")

        const { page, pageSize, status } = parsed.data
        const where = and(eq(bookings.userId, req.user!.id), status ? eq(bookings.status, status) : undefined)

        const [list, total] = await Promise.all([
            loadBookings(where, { limit: pageSize, offset: (page - 1) * pageSize }),
            db.$count(bookings, where),
        ])

        res.status(200).json({
            success: true,
            message: "Bookings fetched successfully",
            bookings: list,
            pagination: paginationMeta(parsed.data, total),
        })

    } catch (error) {
        handleError(error, res)
    }
}


/** GET /api/bookings/:bookingId: the ticket. Someone else's booking is a 404. */
export const getBookingById = async (req: Request, res: Response) => {
    try {
        const parsedParams = bookingIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid booking id")

        const booking = await loadBooking(parsedParams.data.bookingId, req.user!.id)
        if (!booking) return res.status(404).json({ message: "Booking not found" })

        res.status(200).json({ success: true, message: "Booking fetched successfully", booking })

    } catch (error) {
        handleError(error, res)
    }
}
