import { Request, Response } from "express";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db";
import { screeningPrices, screenings, screeningSeats, seats, shows, venues, type SeatCategory } from "../db/schema";
import {
    createScreeningSchema,
    listScreeningsQuerySchema,
    screeningIdParamSchema,
    showScreeningsParamSchema,
    updateScreeningSchema,
    type PricesInput,
} from "./screeningSchemas";
import {
    findOverlappingScreening,
    hasSoldSeats,
    lockShow,
    lockVenue,
    SCREENING_BUFFER_MINUTES,
    screeningEndsAt,
    type Tx,
} from "./screeningRules";
import { ownerScope, type AuthedUser } from "../utils/access";
import { HttpError } from "../utils/httpError";
import { hasPgErrorCode, PG_FOREIGN_KEY_VIOLATION } from "../utils/pgErrors";
import { paginationMeta, sendValidationError } from "../utils/validation";

/*
 * A screening is one show at one venue at one time. Creating it also builds
 * its seat inventory: one screening_seats row per venue seat, priced by the
 * seat's category. That inventory is what the booking module sells.
 *
 * Access follows the show: organizers manage screenings of their own shows,
 * admins of any show. A screening's venue must belong to the show's organizer.
 *
 * Once any seat is held or booked, the venue, time and prices are locked and
 * the screening can only be cancelled.
 */

const SOLD_LOCKED = "Seats for this screening are held or booked, so its venue, time and prices can't change; cancel it instead"

type SeatCounts = { available: number; held: number; booked: number; total: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The seat categories a venue actually has, e.g. ["gold", "sofa"]. */
const venueCategories = async (tx: Tx, venueId: number): Promise<SeatCategory[]> => {
    const rows = await tx.selectDistinct({ category: seats.category }).from(seats).where(eq(seats.venueId, venueId))
    return rows.map((r) => r.category)
}

/**
 * Prices must cover exactly the venue's categories: a missing one would leave
 * seats unpriced, and an extra one is almost certainly a mistake.
 */
const assertPricesMatchVenue = (prices: PricesInput, categories: SeatCategory[]) => {
    if (categories.length === 0) {
        throw new HttpError(409, "This venue has no seats yet; add its seat layout first")
    }
    const missing = categories.filter((c) => prices[c] === undefined)
    if (missing.length > 0) {
        throw new HttpError(400, `Missing price for: ${missing.join(", ")}`)
    }
    const extra = (Object.keys(prices) as SeatCategory[]).filter((c) => prices[c] !== undefined && !categories.includes(c))
    if (extra.length > 0) {
        throw new HttpError(400, `This venue has no ${extra.join(", ")} seats; remove ${extra.length > 1 ? "those prices" : "that price"}`)
    }
}

/**
 * Replaces a screening's prices and rebuilds its seat inventory from the
 * venue's current seats. Only called while nothing is sold, so throwing the
 * old inventory away loses nothing.
 */
const rebuildPricesAndInventory = async (
    tx: Tx,
    screeningId: number,
    venueId: number,
    prices: PricesInput,
    categories: SeatCategory[],
) => {
    await tx.delete(screeningSeats).where(eq(screeningSeats.screeningId, screeningId))
    await tx.delete(screeningPrices).where(eq(screeningPrices.screeningId, screeningId))

    await tx.insert(screeningPrices).values(
        categories.map((category) => ({ screeningId, category, price: prices[category]!.toFixed(2) })),
    )

    // One INSERT ... SELECT, so a venue of any size costs one round trip and
    // never hits the driver's parameter limit.
    const result = await tx.execute(sql`
        INSERT INTO ${screeningSeats} ("screening_id", "seat_id", "price", "status")
        SELECT ${screeningId}::integer, ${seats.id}, ${screeningPrices.price}, 'available'
        FROM ${seats}
        INNER JOIN ${screeningPrices}
            ON ${screeningPrices.screeningId} = ${screeningId}
            AND ${screeningPrices.category} = ${seats.category}
        WHERE ${seats.venueId} = ${venueId}
    `)
    return result.rowCount ?? 0
}

/** Throws a 409 naming the clash if the slot overlaps another screening. */
const assertNoOverlap = async (tx: Tx, slot: Parameters<typeof findOverlappingScreening>[1]) => {
    const clash = await findOverlappingScreening(tx, slot)
    if (clash) {
        throw new HttpError(
            409,
            `This time overlaps screening #${clash.id} at this venue ` +
            `(${clash.startsAt.toISOString()} – ${clash.endsAt.toISOString()}). ` +
            `Screenings in the same venue need ${SCREENING_BUFFER_MINUTES} minutes between them.`,
        )
    }
}

/** Prices and seat counts for a set of screenings, keyed by screening id. */
const loadPricesAndCounts = async (screeningIds: number[]) => {
    const prices = new Map<number, Partial<Record<SeatCategory, string>>>()
    const counts = new Map<number, SeatCounts>()
    if (screeningIds.length === 0) return { prices, counts }

    const [priceRows, countRows] = await Promise.all([
        db.select().from(screeningPrices).where(inArray(screeningPrices.screeningId, screeningIds)),
        db.select({ screeningId: screeningSeats.screeningId, status: screeningSeats.status, n: count() })
            .from(screeningSeats)
            .where(inArray(screeningSeats.screeningId, screeningIds))
            .groupBy(screeningSeats.screeningId, screeningSeats.status),
    ])

    for (const id of screeningIds) {
        prices.set(id, {})
        counts.set(id, { available: 0, held: 0, booked: 0, total: 0 })
    }
    for (const row of priceRows) prices.get(row.screeningId)![row.category] = row.price
    for (const row of countRows) {
        const c = counts.get(row.screeningId)!
        c[row.status] = row.n
        c.total += row.n
    }
    return { prices, counts }
}

/**
 * Reads a screening the user may manage (via its show's owner), without
 * locking. Used to find which show/venue to lock before the real checks.
 */
const findScopedScreening = async (screeningId: number, user: AuthedUser) => {
    const [row] = await db.select({ screening: screenings, orgId: shows.orgId })
        .from(screenings)
        .innerJoin(shows, eq(screenings.showId, shows.id))
        .where(and(eq(screenings.id, screeningId), ownerScope(shows.orgId, user)))
        .limit(1)
    return row
}

const lockScreening = async (tx: Tx, screeningId: number) => {
    const [screening] = await tx.select().from(screenings).where(eq(screenings.id, screeningId)).for("update")
    if (!screening) throw new HttpError(404, "Screening not found")
    return screening
}

/** Full detail for one screening: show, venue, prices and seat counts. */
const loadScreeningDetail = async (screeningId: number) => {
    const [row] = await db.select({
        screening: screenings,
        show: { id: shows.id, title: shows.title, durationMinutes: shows.durationMinutes, status: shows.status },
        venue: { id: venues.id, name: venues.name, city: venues.city },
    })
        .from(screenings)
        .innerJoin(shows, eq(screenings.showId, shows.id))
        .innerJoin(venues, eq(screenings.venueId, venues.id))
        .where(eq(screenings.id, screeningId))
        .limit(1)
    if (!row) return undefined

    const { prices, counts } = await loadPricesAndCounts([screeningId])
    return {
        ...row.screening,
        show: row.show,
        venue: row.venue,
        prices: prices.get(screeningId)!,
        seats: counts.get(screeningId)!,
    }
}

const handleError = (error: unknown, res: Response) => {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
    console.error(error)
    return res.status(500).json({ message: "Internal server error" })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const getShowScreenings = async (req: Request, res: Response) => {
    try {
        const parsedParams = showScreeningsParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid show id")

        const parsed = listScreeningsQuerySchema.safeParse(req.query);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid query")

        const { showId } = parsedParams.data
        const { page, pageSize, status } = parsed.data

        const [show] = await db.select({ id: shows.id }).from(shows)
            .where(and(eq(shows.id, showId), ownerScope(shows.orgId, req.user!)))
            .limit(1)
        if (!show) return res.status(404).json({ message: "Show not found" })

        const where = and(eq(screenings.showId, showId), status ? eq(screenings.status, status) : undefined)

        const [rows, total] = await Promise.all([
            db.select({ screening: screenings, venue: { id: venues.id, name: venues.name, city: venues.city } })
                .from(screenings)
                .innerJoin(venues, eq(screenings.venueId, venues.id))
                .where(where)
                .orderBy(asc(screenings.startsAt), asc(screenings.id))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.$count(screenings, where),
        ])

        const { prices, counts } = await loadPricesAndCounts(rows.map((r) => r.screening.id))

        res.status(200).json({
            success: true,
            message: "Screenings fetched successfully",
            screenings: rows.map((r) => ({
                ...r.screening,
                venue: r.venue,
                prices: prices.get(r.screening.id)!,
                seats: counts.get(r.screening.id)!,
            })),
            pagination: paginationMeta(parsed.data, total),
        })

    } catch (error) {
        handleError(error, res)
    }
}


export const getScreeningById = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const { screeningId } = parsedParams.data

        if (!(await findScopedScreening(screeningId, req.user!))) {
            return res.status(404).json({ message: "Screening not found" })
        }

        const screening = await loadScreeningDetail(screeningId)
        if (!screening) return res.status(404).json({ message: "Screening not found" })

        res.status(200).json({ success: true, message: "Screening fetched successfully", screening })

    } catch (error) {
        handleError(error, res)
    }
}


export const createScreening = async (req: Request, res: Response) => {
    try {
        const parsedParams = showScreeningsParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid show id")

        const parsed = createScreeningSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid screening details")

        const { showId } = parsedParams.data
        const { venueId, startsAt, prices } = parsed.data

        const screeningId = await db.transaction(async (tx) => {
            // Lock order: show → venue (see screeningRules.ts).
            const show = await lockShow(tx, showId, ownerScope(shows.orgId, req.user!), "share")
            if (!show) throw new HttpError(404, "Show not found")

            // The venue must belong to the show's organizer — also when an
            // admin is doing the scheduling.
            const venue = await lockVenue(tx, venueId, eq(venues.ownerId, show.orgId))
            if (!venue) throw new HttpError(404, "Venue not found")

            const categories = await venueCategories(tx, venueId)
            assertPricesMatchVenue(prices, categories)

            const endsAt = screeningEndsAt(startsAt, show.durationMinutes)
            await assertNoOverlap(tx, { venueId, startsAt, endsAt })

            const [screening] = await tx.insert(screenings)
                .values({ showId, venueId, startsAt, endsAt, status: "scheduled" })
                .returning({ id: screenings.id })

            await rebuildPricesAndInventory(tx, screening.id, venueId, prices, categories)
            return screening.id
        })

        const screening = await loadScreeningDetail(screeningId)
        res.status(201).json({ success: true, message: "Screening created", screening })

    } catch (error) {
        handleError(error, res)
    }
}


export const updateScreening = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const parsed = updateScreeningSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid screening details")

        const { screeningId } = parsedParams.data
        const changes = parsed.data

        const found = await findScopedScreening(screeningId, req.user!)
        if (!found) return res.status(404).json({ message: "Screening not found" })

        await db.transaction(async (tx) => {
            // Lock order: show → venue(s) by id → screening (see screeningRules.ts).
            const show = await lockShow(tx, found.screening.showId, undefined, "share")
            if (!show) throw new HttpError(404, "Screening not found")

            const currentVenueId = found.screening.venueId
            const targetVenueId = changes.venueId ?? currentVenueId
            for (const id of [...new Set([currentVenueId, targetVenueId])].sort((a, b) => a - b)) {
                const venue = await lockVenue(tx, id, eq(venues.ownerId, show.orgId))
                if (!venue && id === targetVenueId) throw new HttpError(404, "Venue not found")
            }

            const screening = await lockScreening(tx, screeningId)
            // Moved by a concurrent request between the read above and the locks.
            if (screening.venueId !== currentVenueId) {
                throw new HttpError(409, "This screening was just changed by another request; please retry")
            }
            if (screening.status === "cancelled") throw new HttpError(409, "A cancelled screening can't be changed")
            if (screening.startsAt.getTime() <= Date.now()) throw new HttpError(409, "This screening has already started")
            if (await hasSoldSeats(tx, [screeningId])) throw new HttpError(409, SOLD_LOCKED)

            const venueChanged = targetVenueId !== screening.venueId
            const startsAt = changes.startsAt ?? screening.startsAt
            const endsAt = screeningEndsAt(startsAt, show.durationMinutes)

            if (changes.startsAt || venueChanged) {
                await assertNoOverlap(tx, { venueId: targetVenueId, startsAt, endsAt, excludeScreeningId: screeningId })
            }

            await tx.update(screenings)
                .set({ venueId: targetVenueId, startsAt, endsAt, updatedAt: new Date() })
                .where(eq(screenings.id, screeningId))

            if (venueChanged || changes.prices) {
                // Without new prices, keep the current ones — they must still
                // cover the (possibly new) venue's categories.
                let prices = changes.prices
                if (!prices) {
                    const current = await tx.select().from(screeningPrices).where(eq(screeningPrices.screeningId, screeningId))
                    prices = Object.fromEntries(current.map((p) => [p.category, Number(p.price)])) as PricesInput
                }
                const categories = await venueCategories(tx, targetVenueId)
                assertPricesMatchVenue(prices, categories)
                await rebuildPricesAndInventory(tx, screeningId, targetVenueId, prices, categories)
            }
        })

        const screening = await loadScreeningDetail(screeningId)
        res.status(200).json({ success: true, message: "Screening updated", screening })

    } catch (error) {
        handleError(error, res)
    }
}


export const cancelScreening = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const { screeningId } = parsedParams.data

        if (!(await findScopedScreening(screeningId, req.user!))) {
            return res.status(404).json({ message: "Screening not found" })
        }

        await db.transaction(async (tx) => {
            const screening = await lockScreening(tx, screeningId)
            if (screening.status === "cancelled") throw new HttpError(409, "This screening is already cancelled")
            if (screening.startsAt.getTime() <= Date.now()) throw new HttpError(409, "This screening has already started")

            // Seats and their holds/bookings are kept: refunds are the booking
            // module's job, and it needs to know who held what.
            await tx.update(screenings)
                .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
                .where(eq(screenings.id, screeningId))
        })

        const screening = await loadScreeningDetail(screeningId)
        res.status(200).json({ success: true, message: "Screening cancelled", screening })

    } catch (error) {
        handleError(error, res)
    }
}


export const deleteScreening = async (req: Request, res: Response) => {
    try {
        const parsedParams = screeningIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid screening id")

        const { screeningId } = parsedParams.data

        const found = await findScopedScreening(screeningId, req.user!)
        if (!found) return res.status(404).json({ message: "Screening not found" })

        await db.transaction(async (tx) => {
            await lockScreening(tx, screeningId)
            if (await hasSoldSeats(tx, [screeningId])) {
                throw new HttpError(409, "Seats for this screening are held or booked, so it can't be deleted; cancel it instead")
            }

            await tx.delete(screeningSeats).where(eq(screeningSeats.screeningId, screeningId))
            await tx.delete(screeningPrices).where(eq(screeningPrices.screeningId, screeningId))
            await tx.delete(screenings).where(eq(screenings.id, screeningId))
        })

        res.status(200).json({ success: true, message: "Screening deleted", screening: found.screening })

    } catch (error) {
        // Backstop: a booking row referencing this screening.
        if (hasPgErrorCode(error, PG_FOREIGN_KEY_VIOLATION)) {
            return res.status(409).json({ message: "This screening has bookings and can't be deleted; cancel it instead" })
        }
        handleError(error, res)
    }
}
