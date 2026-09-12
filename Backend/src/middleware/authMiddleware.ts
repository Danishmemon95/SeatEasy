import { NextFunction, Request, Response } from "express";
import { UserRole, users } from "../db/schema";
import jwt, { JsonWebTokenError, TokenExpiredError, type JwtPayload } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
                email: string;
                role: UserRole;
                isVerified: boolean;
            }
        }
    }
}

export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const token = req.cookies.jwt

        if (!token) {
            return res.status(401).json({ message: "Unauthorized - No token provided" })
        }

        let decoded: JwtPayload
        try {
            decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                return res.status(401).json({ message: "Unauthorized - Token expired" });
            }
            if (error instanceof JsonWebTokenError) {
                return res.status(401).json({ message: "Unauthorized - Invalid Token" });
            }
            throw error;
        }

        const [user] = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
            isVerified: users.isVerified,
        }).from(users).where(eq(users.id, decoded.userId));

        if (!user) {
            return res.status(401).json({ message: "Unauthorized - Session no longer valid" });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email address to continue.",
                code: "EMAIL_NOT_VERIFIED",
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" });
    }
}

export const requireRole = (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    
    next();
}