import { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../config/db";
import { venues } from "../db/schema";
import { listVenuesQuerySchema, updateVenueSchema, venueIdParamSchema, venueSchema } from "./venueSchemas";
import { hasPgErrorCode, PG_FOREIGN_KEY_VIOLATION } from "../utils/pgErrors";
import { ownerScope } from "../utils/access";
import { paginationMeta, sendValidationError } from "../utils/validation";

/*
 * Organizers work with their own venues; admins with every venue. Ownership is
 * applied in the query itself (ownerScope), so another organizer's venue is
 * indistinguishable from a missing one: both are a 404.
 */

export const getVenues = async (req: Request, res: Response) => {
    try {
        const parsed = listVenuesQuerySchema.safeParse(req.query);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid query")

        const { page, pageSize } = parsed.data
        const scope = ownerScope(venues.ownerId, req.user!)

        const [venueList, total] = await Promise.all([
            db.select().from(venues)
                .where(scope)
                .orderBy(desc(venues.createdAt), desc(venues.id))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.$count(venues, scope),
        ])

        res.status(200).json({
            success: true,
            message: "Venues fetched successfully",
            venues: venueList,
            pagination: paginationMeta(parsed.data, total),
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const getVenueById = async (req: Request, res: Response) => {
    try {
        const parsedParams = venueIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid venue id")

        const [venue] = await db.select().from(venues)
            .where(and(eq(venues.id, parsedParams.data.venueId), ownerScope(venues.ownerId, req.user!)))
            .limit(1)

        if (!venue) return res.status(404).json({ message: "Venue not found" })

        res.status(200).json({ success: true, message: "Venue fetched successfully", venue })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const createVenue = async (req: Request, res: Response) => {
    try {
        const parsed = venueSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid venue details")

        // Only organizers reach this route (see venueRoutes), and the venue is
        // always theirs: ownership comes from the session, never the body.
        const [venue] = await db.insert(venues)
            .values({ ...parsed.data, ownerId: req.user!.id })
            .returning()

        res.status(201).json({ success: true, message: "Venue created", venue })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const updateVenue = async (req: Request, res: Response) => {
    try {
        const parsedParams = venueIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid venue id")

        const parsed = updateVenueSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid venue details")

        if (Object.keys(parsed.data).length === 0) {
            return res.status(400).json({ message: "Provide at least one field to update" })
        }

        const [venue] = await db.update(venues)
            .set({ ...parsed.data, updatedAt: new Date() })
            .where(and(eq(venues.id, parsedParams.data.venueId), ownerScope(venues.ownerId, req.user!)))
            .returning()

        if (!venue) return res.status(404).json({ message: "Venue not found" })

        res.status(200).json({ success: true, message: "Venue updated", venue })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const deleteVenue = async (req: Request, res: Response) => {
    try {
        const parsedParams = venueIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) return sendValidationError(res, parsedParams.error, "Invalid venue id")

        const [venue] = await db.delete(venues)
            .where(and(eq(venues.id, parsedParams.data.venueId), ownerScope(venues.ownerId, req.user!)))
            .returning()

        if (!venue) return res.status(404).json({ message: "Venue not found" })

        res.status(200).json({ success: true, message: "Venue deleted", venue })

    } catch (error) {
        // Seats are removed with the venue (cascade), but a venue that has any
        // screening — past, upcoming or cancelled — is protected by its foreign key.
        if (hasPgErrorCode(error, PG_FOREIGN_KEY_VIOLATION)) {
            return res.status(409).json({ message: "This venue has screenings and cannot be deleted" })
        }
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}
