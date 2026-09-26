import { z } from "zod";
import { idParam, paginationSchema } from "../utils/validation";

/**
 * Request shapes for the show (event) endpoints.
 *
 * The value lists mirror the pg enums in db/schema.ts, kept explicit so this
 * file has no DB dependency (same reasoning as orgApplicationSchemas.ts).
 */

export const showTypeValues = ["movie", "concert", "play", "comedy", "sports", "other"] as const;
export const ageRatingValues = ["U", "UA", "A"] as const;
export const showStatusValues = ["draft", "published"] as const;

const MAX_DURATION_MINUTES = 12 * 60;

export const createShowSchema = z.object({
    title: z
        .string()
        .trim()
        .min(2, "Title must be at least 2 characters")
        .max(100, "Title cannot exceed 100 characters"),
    description: z
        .string()
        .trim()
        .min(10, "Description must be at least 10 characters")
        .max(5000, "Description cannot exceed 5000 characters"),
    type: z.enum(showTypeValues, {
        message: `Type must be one of: ${showTypeValues.join(", ")}`,
    }),
    // Optional; null clears it on update.
    genre: z
        .string()
        .trim()
        .min(2, "Genre must be at least 2 characters")
        .max(50, "Genre cannot exceed 50 characters")
        .nullable()
        .optional(),
    language: z
        .string()
        .trim()
        .min(2, "Language must be at least 2 characters")
        .max(50, "Language cannot exceed 50 characters"),
    durationMinutes: z.coerce
        .number()
        .int("Duration must be a whole number of minutes")
        .min(1, "Duration must be at least 1 minute")
        .max(MAX_DURATION_MINUTES, `Duration cannot exceed ${MAX_DURATION_MINUTES} minutes`),
    ageRating: z.enum(ageRatingValues, {
        message: `Age rating must be one of: ${ageRatingValues.join(", ")}`,
    }),
    // https only: the URL is rendered in buyers' browsers, and an http image on
    // an https page is blocked or flagged as mixed content.
    posterUrl: z
        .url({ protocol: /^https$/, message: "Poster URL must be a valid https URL" })
        .max(2000, "Poster URL cannot exceed 2000 characters")
        .nullable()
        .optional(),
});

// Strict so a client that sends "status" or "orgId" gets a 400 instead of
// having the field silently ignored: publishing has its own endpoint and
// ownership never changes.
export const updateShowSchema = createShowSchema.partial().strict();

export const showIdParamSchema = idParam("showId");

export const listShowsQuerySchema = paginationSchema.extend({
    status: z.enum(showStatusValues, {
        message: `Status must be one of: ${showStatusValues.join(", ")}`,
    }).optional(),
});

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type UpdateShowInput = z.infer<typeof updateShowSchema>;
