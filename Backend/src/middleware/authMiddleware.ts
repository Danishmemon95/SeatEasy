import { NextFunction, Request, Response } from "express";
import { UserRole, users } from "../db/schema";
import jwt, { JsonWebTokenError, TokenExpiredError, type JwtPayload } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { env } from "../config/env";

// JWT iat has one-second resolution, so a token issued in the same second as a
// password change can look up to a second older than it is.
const IAT_SLACK_MS = 1000;

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
                email: string;
                role: UserRole;
                isVerified: boolean;
                city: string | null;
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

        const [row] = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
            isVerified: users.isVerified,
            city: users.city,
            passwordChangedAt: users.passwordChangedAt,
        }).from(users).where(eq(users.id, decoded.userId));

        if (!row) {
            return res.status(401).json({ message: "Unauthorized - Session no longer valid" });
        }

        const { passwordChangedAt, ...user } = row;

        // A password reset or change signs out every session issued before it.
        if (
            passwordChangedAt &&
            (decoded.iat === undefined || passwordChangedAt.getTime() - IAT_SLACK_MS > decoded.iat * 1000)
        ) {
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