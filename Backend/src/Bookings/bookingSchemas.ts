import { z } from "zod";
import { idParam, paginationSchema } from "../utils/validation";

// Mirrors bookingStatusEnum in db/schema.ts.
export const bookingStatusValues = ["pending", "confirmed", "cancelled"] as const;

// POST /api/bookings: books the caller's live holds on this screening.
// No seat ids or amounts: the server books exactly what the caller holds and
// prices it from the inventory, so a client can't choose its own total.
export const createBookingSchema = z.object({
    screeningId: z.coerce.number().int().positive("A valid screeningId is required"),
});

export const bookingIdParamSchema = idParam("bookingId");

export const listMyBookingsQuerySchema = paginationSchema.extend({
    status: z.enum(bookingStatusValues, {
        message: `Status must be one of: ${bookingStatusValues.join(", ")}`,
    }).optional(),
});
