import { z } from "zod";
import { idParam, paginationSchema } from "../utils/validation";

/**
 * Request shapes for the venue endpoints.
 *
 * Mirrors the column limits in db/schema.ts (varchar(100) for name/city) so a
 * validation failure here always matches what the DB would actually reject.
 */

export const venueSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Venue name must be at least 2 characters")
        .max(100, "Venue name cannot exceed 100 characters"),
    city: z
        .string()
        .trim()
        .min(2, "Venue city must be at least 2 characters")
        .max(100, "Venue city cannot exceed 100 characters"),
    address: z
        .string()
        .trim()
        .min(5, "Venue address must be at least 5 characters")
        .max(300, "Venue address cannot exceed 300 characters"),
});

// Every field optional so an update can send just what changed, while still
// running each provided field through the same rules as create.
export const updateVenueSchema = venueSchema.partial();

export const venueIdParamSchema = idParam("venueId");

export const listVenuesQuerySchema = paginationSchema;

export type VenueInput = z.infer<typeof venueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
