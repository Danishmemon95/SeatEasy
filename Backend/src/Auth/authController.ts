import { Request, Response } from "express";
import { db } from "../config/db";
import { orgApplications, users } from "../db/schema";
import { and, eq, gt, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken";
import { authCookieOptions } from "../utils/cookieOptions";
import { hashPassword, comparePassword } from "../utils/password";
import { createVerificationToken, hashVerificationToken } from "../utils/verificationToken";
import { registerSchema, loginSchema, verifyQuerySchema } from "./authSchemas";
import { env } from "../config/env";

const INVALID_CREDENTIALS = "Invalid email or password";

const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.LMB8Zt3aB0iZ0OqQvFB6vJPQXPvC";

export const register = async (req: Request, res: Response) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: parsed.error.issues[0]?.message ?? "Invalid registration details",
                errors: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            });
        }

        const { username, email, password } = parsed.data;

        const [existingUser] = await db
            .select({ id: users.id, email: users.email, isVerified: users.isVerified })
            .from(users)
            .where(or(eq(users.email, email), eq(users.username, username)))
            .limit(1);

        const passwordHash = await hashPassword(password);

        const acceptedResponse = {
            message: "If that email is available, a verification link has been sent. Please check your inbox.",
        };

        if (existingUser) {
            if (existingUser.email !== email) {
                return res.status(202).json(acceptedResponse);
            }

            if (existingUser.isVerified) {
                console.log(`Register attempt for already verified account: ${email}`);
                return res.status(202).json(acceptedResponse);
            }

            const { token, tokenHash, expiresAt } = createVerificationToken();

            const updated = await db
                .update(users)
                .set({
                    verificationTokenHash: tokenHash,
                    verificationTokenExpires: expiresAt,
                    updatedAt: new Date(),
                })
                .where(and(eq(users.id, existingUser.id), eq(users.isVerified, false)))
                .returning({ id: users.id });

            if (updated.length > 0) {
                console.log(`Verify link: ${env.SERVER_URL}/api/auth/verify?token=${token}`);
            }
            return res.status(202).json(acceptedResponse);
        }

        const { token, tokenHash, expiresAt } = createVerificationToken();

        await db.insert(users).values({
            username,
            email,
            passwordHash,
            verificationTokenHash: tokenHash,
            verificationTokenExpires: expiresAt,
        });

        console.log(`Verify link: ${env.SERVER_URL}/api/auth/verify?token=${token}`);

        return res.status(202).json(acceptedResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: parsed.error.issues[0]?.message ?? "Invalid login details",
            });
        }

        const { email, password } = parsed.data;

        const [user] = await db
            .select({
                id: users.id,
                username: users.username,
                email: users.email,
                role: users.role,
                isVerified: users.isVerified,
                passwordHash: users.passwordHash,
            })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        const validPassword = await comparePassword(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !validPassword) {
            return res.status(401).json({ message: INVALID_CREDENTIALS });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email address before signing in.",
                code: "EMAIL_NOT_VERIFIED",
            });
        }

        generateToken(user.id, res);
        const { passwordHash, ...safeUser } = user;
        return res.status(200).json({ message: "Login successful", user: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};


export const logout = async (req: Request, res: Response) => {
    try {
        res.clearCookie("jwt", authCookieOptions);
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};


export const verifyUser = async (req: Request, res: Response) => {
    try {
        const parsed = verifyQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid or expired verification link" });
        }

        const tokenHash = hashVerificationToken(parsed.data.token);

        const [verified] = await db
            .update(users)
            .set({
                isVerified: true,
                verificationTokenHash: null,
                verificationTokenExpires: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(users.verificationTokenHash, tokenHash),
                    eq(users.isVerified, false),
                    gt(users.verificationTokenExpires, new Date()),
                ),
            )
            .returning({
                id: users.id,
                username: users.username,
                email: users.email,
                role: users.role,
                isVerified: users.isVerified,
            });

        if (!verified) {
            return res.status(400).json({
                message: "This verification link is invalid, expired, or already used.",
            });
        }

        generateToken(verified.id, res);

        return res.status(200).json({ message: "Email verified successfully", user: verified });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};



export const checkAuth = async (req: Request, res: Response) => {
    try {
        res.status(200).json({ success: true, message: "Authenticated", user: req.user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};
