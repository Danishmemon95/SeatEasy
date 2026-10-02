import { z } from "zod";

export const applyOrgSchema = z.object({
    description: z
        .string()
        .trim()
        .min(10, "Please describe your application in at least 10 characters")
        .max(2000, "Description cannot exceed 2000 characters"),
});

export const applicationStatusValues = ["pending", "approved", "rejected"] as const;

// An admin decision moves an application out of "pending", never back into it.
export const applicationDecisionValues = ["approved", "rejected"] as const;

export const applicationDecisionSchema = z.object({
    applicationId: z.coerce.number().int().positive("A valid applicationId is required"),
    status: z.enum(applicationDecisionValues, {
        message: `Status must be one of: ${applicationDecisionValues.join(", ")}`,
    }),
});

export type ApplyOrgInput = z.infer<typeof applyOrgSchema>;
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
