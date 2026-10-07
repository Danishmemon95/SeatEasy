import { z } from "zod";
import { showTypeValues } from "../Shows/showSchemas";
import { paginationSchema } from "../utils/validation";

export const listCatalogQuerySchema = paginationSchema.extend({
    city: z.string().trim().min(1).max(100).optional(),
    // An IST calendar day (YYYY-MM-DD), or "weekend" for this Saturday + Sunday
    // in IST: the same range as the home page's weekend row.
    date: z.union([
        z.literal("weekend"),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD or weekend"),
    ], { message: "date must be YYYY-MM-DD or weekend" }).optional(),
    type: z.enum(showTypeValues, {
        message: `Type must be one of: ${showTypeValues.join(", ")}`,
    }).optional(),
});
// GET /api/catalog/home?city=  The home page always belongs to one city.
export const homeQuerySchema = z.object({
    city: z.string({ message: "city is required" }).trim().min(1, "city is required").max(100),
});
