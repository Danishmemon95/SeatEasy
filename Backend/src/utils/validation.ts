import type { Response } from "express";
import { z } from "zod";

/**
 * Sends the standard 400 body for a failed zod parse: the first issue as the
 * headline message, plus every issue with its field path for form display.
 */
export const sendValidationError = (res: Response, error: z.ZodError, fallbackMessage: string) =>
    res.status(400).json({
        message: error.issues[0]?.message ?? fallbackMessage,
        errors: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
        })),
    });

/** A positive integer route param, e.g. idParam("venueId") for /:venueId. */
export const idParam = <K extends string>(name: K) =>
    z.object({
        [name]: z.coerce.number().int().positive(`A valid ${name} is required`),
    } as Record<K, z.ZodCoercedNumber<unknown>>);

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1, "page must be 1 or more").default(1),
    pageSize: z.coerce.number().int().min(1).max(100, "pageSize cannot exceed 100").default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const paginationMeta = ({ page, pageSize }: Pagination, total: number) => ({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
});
