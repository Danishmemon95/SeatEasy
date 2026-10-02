import { Request, Response } from "express";
import { orgApplications, users } from "../db/schema";
import { db } from "../config/db";
import { and, desc, eq } from "drizzle-orm";
import { applyOrgSchema, applicationDecisionSchema } from "./orgApplicationSchemas";


export const applyOrg = async (req: Request, res: Response) => {
    try {

        const parsed = applyOrgSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: parsed.error.issues[0]?.message ?? "Invalid application details",
                errors: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            });
        }

        const { description } = parsed.data
        const user = req.user!

        const [alreadyApplied] = await db.select({ id: orgApplications.id }).from(orgApplications)
            .where(eq(orgApplications.requesterId, user.id)).limit(1)

        if (alreadyApplied) return res.status(409).json({ message: "You have already submitted an application" })

        const [application] = await db.insert(orgApplications).values({
            description,
            requesterId: user.id,
            status: "pending",
        }).returning()

        res.status(201).json({ success: true, message: "Application sent", application })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const myApplication = async (req: Request, res: Response) => {
    try {
        const user = req.user!

        const [application] = await db.select().from(orgApplications)
            .where(eq(orgApplications.requesterId, user.id))
            .orderBy(desc(orgApplications.createdAt), desc(orgApplications.id))
            .limit(1)

        if (!application) return res.status(404).json({ message: "No application found" })

        res.status(200).json({ success: true, message: "Application fetched successfully", application })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const applicationList = async (req: Request, res: Response) => {
    try {
        const applications = await db.select().from(orgApplications)
            .orderBy(desc(orgApplications.createdAt), desc(orgApplications.id))

        res.status(200).json({ success: true, message: "List fetched successfully", applications })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const applicationDecision = async (req: Request, res: Response) => {
    try {

        const user = req.user!

        const parsed = applicationDecisionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: parsed.error.issues[0]?.message ?? "Invalid decision details",
                errors: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            });
        }

        const { applicationId, status } = parsed.data;

        const result = await db.transaction(async (tx) => {
            const [updated] = await tx.update(orgApplications).set({
                status,
                reviewerId: user.id,
                reviewedAt: new Date(),
                updatedAt: new Date(),
            }).where(and(
                eq(orgApplications.id, applicationId),
                eq(orgApplications.status, "pending"),
            )).returning()

            if (!updated) {
                const [existing] = await tx.select({ id: orgApplications.id }).from(orgApplications)
                    .where(eq(orgApplications.id, applicationId)).limit(1)
                return { error: existing ? "already_decided" : "not_found" } as const
            }

            let promotedUser = null
            if (status === "approved") {
                // Only promote buyers, so an admin is never downgraded to organizer.
                // Return just id/role so password and token hashes never leave the server.
                const [makeOrg] = await tx.update(users).set({ role: "organizer", updatedAt: new Date() })
                    .where(and(eq(users.id, updated.requesterId), eq(users.role, "buyer")))
                    .returning({ id: users.id, role: users.role })
                promotedUser = makeOrg ?? null
            }

            return { updated, promotedUser }
        })

        if ("error" in result) {
            return result.error === "not_found"
                ? res.status(404).json({ message: "Application not found" })
                : res.status(409).json({ message: "This application has already been reviewed" })
        }

        return res.status(200).json({
            success: true,
            message: status === "approved" ? "Application approved" : "Application rejected",
            application: result.updated,
            user: result.promotedUser,
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}