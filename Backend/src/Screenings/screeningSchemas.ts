import { z } from "zod";
import { idParam, paginationSchema } from "../utils/validation";

/**
 * Request shapes for the screening endpoints.
 *
 * Times: all venues are in India, but the API never guesses a timezone. A start
 * time must carry an explicit offset (2026-10-05T19:30:00+05:30, or Z for UTC);
 * it is stored and returned as UTC.
 */

export const MIN_LEAD_HOURS = 24;
export const MAX_DAYS_AHEAD = 180;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const screeningStatusValues = ["scheduled", "cancelled"] as const;

const startsAtSchema = z
    .iso.datetime({
        offset: true,
        message: "startsAt must be an ISO date-time with a timezone offset, e.g. 2026-10-05T19:30:00+05:30",
    })
    .transform((value) => new Date(value))
    .refine(
        (date) => date.getTime() >= Date.now() + MIN_LEAD_HOURS * HOUR_MS,
        `A screening must start at least ${MIN_LEAD_HOURS} hours from now`,
    )
    .refine(
        (date) => date.getTime() <= Date.now() + MAX_DAYS_AHEAD * DAY_MS,
        `A screening can't be scheduled more than ${MAX_DAYS_AHEAD} days ahead`,
    );

const priceSchema = z.coerce
    .number()
    .min(0, "Price cannot be negative")
    .max(100000, "Price cannot exceed 100000")
    .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
        "Price can have at most 2 decimal places",
    );

// One price per seat category. Strict, so a misspelt category ("gld") is a 400
// rather than silently ignored. Which categories are *required* depends on the
// venue's seats, so that check happens in the controller.
export const pricesSchema = z
    .strictObject({
        gold: priceSchema.optional(),
        platinum: priceSchema.optional(),
        sofa: priceSchema.optional(),
    })
    .refine((prices) => Object.values(prices).some((p) => p !== undefined), "Provide at least one price");

export const createScreeningSchema = z.object({
    venueId: z.coerce.number().int().positive("A valid venueId is required"),
    startsAt: startsAtSchema,
    prices: pricesSchema,
});

export const updateScreeningSchema = z
    .strictObject({
        venueId: z.coerce.number().int().positive("A valid venueId is required").optional(),
        startsAt: startsAtSchema.optional(),
        prices: pricesSchema.optional(),
    })
    .refine(
        (body) => body.venueId !== undefined || body.startsAt !== undefined || body.prices !== undefined,
        "Provide at least one of venueId, startsAt or prices",
    );

export const showScreeningsParamSchema = idParam("showId");
export const screeningIdParamSchema = idParam("screeningId");

export const listScreeningsQuerySchema = paginationSchema.extend({
    status: z.enum(screeningStatusValues, {
        message: `Status must be one of: ${screeningStatusValues.join(", ")}`,
    }).optional(),
});

export type PricesInput = z.infer<typeof pricesSchema>;
export type CreateScreeningInput = z.infer<typeof createScreeningSchema>;
export type UpdateScreeningInput = z.infer<typeof updateScreeningSchema>;
