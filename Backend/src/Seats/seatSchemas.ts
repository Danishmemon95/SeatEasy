import { z } from "zod";

/**
 * Request shapes for the seat endpoints.
 *
 * Seats are created a row at a time: the admin describes the layout
 * ("row A has 10 gold seats") and the server creates each individual seat.
 */

// Mirrors seatCategoryEnum in db/schema.ts, kept explicit so this file has no
// DB dependency (same reasoning as orgApplicationSchemas.ts).
export const seatCategoryValues = ["gold", "platinum", "sofa"] as const;

const MAX_ROWS_PER_REQUEST = 100;
const MAX_SEATS_PER_ROW = 100;

const categorySchema = z.enum(seatCategoryValues, {
    message: `Category must be one of: ${seatCategoryValues.join(", ")}`,
});

const rowLabelSchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,3}$/, "Row label must be 1 to 3 letters, e.g. A or AA");

export const addSeatRowsSchema = z.object({
    rows: z
        .array(
            z.object({
                row: rowLabelSchema,
                seats: z.coerce
                    .number()
                    .int("Seat count must be a whole number")
                    .min(1, "A row needs at least 1 seat")
                    .max(MAX_SEATS_PER_ROW, `A row cannot have more than ${MAX_SEATS_PER_ROW} seats`),
                category: categorySchema,
            }),
        )
        .min(1, "Provide at least one row")
        .max(MAX_ROWS_PER_REQUEST, `Cannot add more than ${MAX_ROWS_PER_REQUEST} rows at once`)
        .refine(
            (rows) => new Set(rows.map((r) => r.row)).size === rows.length,
            "Each row label can only appear once",
        ),
});

export const updateSeatSchema = z.object({
    category: categorySchema,
});

export const venueSeatsParamSchema = z.object({
    venueId: z.coerce.number().int().positive("A valid venue id is required"),
});

export const seatParamSchema = venueSeatsParamSchema.extend({
    seatId: z.coerce.number().int().positive("A valid seat id is required"),
});

export const seatRowParamSchema = venueSeatsParamSchema.extend({
    row: rowLabelSchema,
});

export type AddSeatRowsInput = z.infer<typeof addSeatRowsSchema>;
export type UpdateSeatInput = z.infer<typeof updateSeatSchema>;
