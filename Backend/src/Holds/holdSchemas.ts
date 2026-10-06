import { z } from "zod";
import { MAX_HELD_SEATS } from "../Screenings/screeningRules";

// POST /api/screenings/:screeningId/holds
// Seat ids are screening_seats ids (from the catalog seat map), not seats ids.
export const holdSeatsSchema = z.object({
    seatIds: z
        .array(z.coerce.number().int().positive("Seat ids must be positive integers"))
        .min(1, "Choose at least one seat")
        .max(MAX_HELD_SEATS, `You can hold at most ${MAX_HELD_SEATS} seats`)
        .refine((ids) => new Set(ids).size === ids.length, "Each seat can only be listed once"),
});

export type HoldSeatsInput = z.infer<typeof holdSeatsSchema>;
