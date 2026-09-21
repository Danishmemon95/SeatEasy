import { Request, Response } from "express";
import { orgApplications, users } from "../db/schema";
import { db } from "../config/db";
import { eq } from "drizzle-orm";
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
        const user = req.user

        if (!user) return res.status(401).json({ message: "Unauthorized" })

        const [alreadyApplied] = await db.select({ requesterId: orgApplications.id }).from(orgApplications).where(eq(orgApplications.requesterId, user.id)).limit(1)

        if (alreadyApplied) return res.status(400).json({ message: "already applied" })

        const application = await db.insert(orgApplications).values({
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
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" })

        const [application] = await db.select().from(orgApplications).where(eq(orgApplications.requesterId, user.id))

        if (!application) return res.status(404).json({ message: "No application found" })

        res.status(200).json({ success: true, message: "Application fetched successfully", application })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const applicationList = async (req: Request, res: Response) => {
    try {
        const user = req.user;

        if (!user) return res.status(401).json({ message: "Unauthorized" })

        if (user.role !== "admin") return res.status(403).json({ message: "You don't have permission to get the application list" })

        const applications = await db.select().from(orgApplications)
        res.status(200).json({ success: true, message: "List fetched successfully", applications })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}


export const applicationDecision = async (req: Request, res: Response) => {
    try {

        const user = req.user;

        if (!user) return res.status(401).json({ message: "Unauthorized" })

        if (user.role !== "admin") return res.status(403).json({ message: "You don't have permission to update the application status" })

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
                reviewedAt: new Date()
            }).where(eq(orgApplications.id, applicationId)).returning()

            if (!updated) return null

            let promotedUser = null
            if (status === "approved") {
                const [makeOrg] = await tx.update(users).set({ role: "organizer" })
                    .where(eq(users.id, updated.requesterId)).returning()
                promotedUser = makeOrg
            }

            return { updated, promotedUser }
        })

        if (!result) return res.status(404).json({ message: "Application not found" })

        return res.status(200).json({
            success: true,
            message: status === "approved" ? "Application approved" : "Application status updated",
            application: result.updated,
            user: result.promotedUser,
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}