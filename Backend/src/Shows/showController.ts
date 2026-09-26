import { Request, Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../config/db";
import { screeningPrices, screenings, screeningSeats, shows, venues } from "../db/schema";
import { createShowSchema, listShowsQuerySchema, showIdParamSchema, updateShowSchema } from "./showSchemas";
import { ownerScope } from "../utils/access";
import { HttpError } from "../utils/httpError";
import { hasPgErrorCode, PG_FOREIGN_KEY_VIOLATION } from "../utils/pgErrors";
import { paginationMeta, sendValidationError } from "../utils/validation";
import { hasSoldSeats, lockShow } from "../Screenings/screeningRules";

/*
 * Shows are the "events" of the UI: any live event an organizer runs.
 * Organizers work with their own shows; admins with all of them. Ownership is
 * part of every query (ownerScope), so another organizer's show is a 404.
 */

export const getShows = async (req: Request, res: Response) => {
    try {
        const parsed = listShowsQuerySchema.safeParse(req.query);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid query")

        const { page, pageSize, status } = parsed.data
        const where = and(
            ownerScope(shows.orgId, req.user!),
            status ? eq(shows.status, status) : undefined,
        )

        const [showList, total] = await Promise.all([
            db.select().from(shows)
                .where(where)
                .orderBy(desc(shows.createdAt), desc(shows.id))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.$count(shows, where),
        ])

        res.status(200).json({
            success: true,
            message: "Shows fetched successfully",
            shows: showList,
            pagination: paginationMeta(parsed.data, total),
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const getShowById = async (req: Request, res: Response) => {
    try {
        const parsedParams = showIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid show id")

        const { showId } = parsedParams.data

        const [show] = await db.select().from(shows)
            .where(and(eq(shows.id, showId), ownerScope(shows.orgId, req.user!)))
            .limit(1)
        if (!show) return res.status(404).json({ message: "Show not found" })

        // A compact schedule; prices and seat counts live on the screenings endpoints.
        const schedule = await db.select({
            id: screenings.id,
            venueId: screenings.venueId,
            venueName: venues.name,
            venueCity: venues.city,
            startsAt: screenings.startsAt,
            endsAt: screenings.endsAt,
            status: screenings.status,
        })
            .from(screenings)
            .innerJoin(venues, eq(screenings.venueId, venues.id))
            .where(eq(screenings.showId, showId))
            .orderBy(asc(screenings.startsAt))

        res.status(200).json({ success: true, message: "Show fetched successfully", show: { ...show, screenings: schedule } })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const createShow = async (req: Request, res: Response) => {
    try {
        const parsed = createShowSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid show details")

        // Only organizers reach this route, and the show is always theirs.
        // It starts as a draft; publishing is a separate, deliberate step.
        const [show] = await db.insert(shows)
            .values({ ...parsed.data, orgId: req.user!.id, status: "draft" })
            .returning()

        res.status(201).json({ success: true, message: "Show created", show })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const updateShow = async (req: Request, res: Response) => {
    try {
        const parsedParams = showIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid show id")

        const parsed = updateShowSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid show details")

        if (Object.keys(parsed.data).length === 0) {
            return res.status(400).json({ message: "Provide at least one field to update" })
        }

        const { showId } = parsedParams.data
        const changes = parsed.data

        const show = await db.transaction(async (tx) => {
            // Locked so a screening can't be added between the duration check
            // and the update (screening creation takes a share lock on the show).
            const current = await lockShow(tx, showId, ownerScope(shows.orgId, req.user!))
            if (!current) throw new HttpError(404, "Show not found")

            // Every screening stores its end time from the duration, so the
            // duration is fixed once any non-cancelled screening exists.
            if (changes.durationMinutes !== undefined && changes.durationMinutes !== current.durationMinutes) {
                const [active] = await tx.select({ id: screenings.id }).from(screenings)
                    .where(and(eq(screenings.showId, showId), eq(screenings.status, "scheduled")))
                    .limit(1)
                if (active) {
                    throw new HttpError(409, "Duration can't change while the show has scheduled screenings")
                }
            }

            const [updated] = await tx.update(shows)
                .set({ ...changes, updatedAt: new Date() })
                .where(eq(shows.id, showId))
                .returning()
            return updated
        })

        res.status(200).json({ success: true, message: "Show updated", show })

    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const publishShow = async (req: Request, res: Response) => {
    try {
        const parsedParams = showIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid show id")

        const { showId } = parsedParams.data
        const scope = ownerScope(shows.orgId, req.user!)

        // Publishing is one-way. Matching on status in the UPDATE itself means
        // two concurrent publishes can't both succeed.
        const [show] = await db.update(shows)
            .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(shows.id, showId), eq(shows.status, "draft"), scope))
            .returning()

        if (!show) {
            const [existing] = await db.select({ id: shows.id }).from(shows)
                .where(and(eq(shows.id, showId), scope))
                .limit(1)
            if (!existing) return res.status(404).json({ message: "Show not found" })
            return res.status(409).json({ message: "Show is already published" })
        }

        res.status(200).json({ success: true, message: "Show published", show })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const deleteShow = async (req: Request, res: Response) => {
    try {
        const parsedParams = showIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid show id")

        const { showId } = parsedParams.data

        const show = await db.transaction(async (tx) => {
            const current = await lockShow(tx, showId, ownerScope(shows.orgId, req.user!))
            if (!current) throw new HttpError(404, "Show not found")

            const showScreenings = await tx.select({ id: screenings.id }).from(screenings)
                .where(eq(screenings.showId, showId))
                .for("update")
            const screeningIds = showScreenings.map((s) => s.id)

            if (await hasSoldSeats(tx, screeningIds)) {
                throw new HttpError(409, "This show has sold or held seats and can't be deleted; cancel its screenings instead")
            }

            // Children first, following the foreign keys.
            if (screeningIds.length > 0) {
                await tx.delete(screeningSeats).where(inArray(screeningSeats.screeningId, screeningIds))
                await tx.delete(screeningPrices).where(inArray(screeningPrices.screeningId, screeningIds))
                await tx.delete(screenings).where(inArray(screenings.id, screeningIds))
            }
            await tx.delete(shows).where(eq(shows.id, showId))

            return current
        })

        res.status(200).json({ success: true, message: "Show deleted", show })

    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
        // Backstop: a booking row referencing one of its screenings.
        if (hasPgErrorCode(error, PG_FOREIGN_KEY_VIOLATION)) {
            return res.status(409).json({ message: "This show has bookings and can't be deleted" })
        }
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}
