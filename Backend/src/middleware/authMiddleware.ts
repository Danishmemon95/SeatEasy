import { NextFunction, Request, Response } from "express";
import { users } from "../db/schema";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../config/db";

declare module "express" {
    export interface Request {
        user?: {
            id: number;
            username: string;
            email: string;
            role: string;
        }
    }
}

export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const token = req.cookies.jwt

        if (!token) {
            return res.status(401).json({ message: "Unauthorized - No token provided" })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string)

        if (!decoded) {
            return res.status(401).json({ message: "Unauthorized - Invalid Token" });
        }

        const [user] = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
        }).from(users).where(eq(users.id, (decoded as any).userId));

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" });
    }
}