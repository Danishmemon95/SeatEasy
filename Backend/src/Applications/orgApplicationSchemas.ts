import { z } from "zod";

/**
 * Request shapes for the org-application endpoints.
 *
 * These are the ones that actually count — inputs come straight from
 * req.body/req.params and must not be trusted until they pass through here.
 */

export const applyOrgSchema = z.object({
    description: z
        .string()
        .trim()
        .min(10, "Please describe your application in at least 10 characters")
        .max(2000, "Description cannot exceed 2000 characters"),
});

// Mirrors the applicationStatusEnum in db/schema.ts. Kept as an explicit list
// (rather than importing the pg enum) so this file has no DB dependency and
// the accepted values are visible at a glance.
export const applicationStatusValues = ["pending", "approved", "rejected"] as const;

export const applicationDecisionSchema = z.object({
    applicationId: z.coerce.number().int().positive("A valid applicationId is required"),
    status: z.enum(applicationStatusValues, {
        message: `Status must be one of: ${applicationStatusValues.join(", ")}`,
    }),
});

export type ApplyOrgInput = z.infer<typeof applyOrgSchema>;
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
