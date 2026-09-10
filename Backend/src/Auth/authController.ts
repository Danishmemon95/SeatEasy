import { Request, Response } from "express";
import { db } from "../config/db";
import { users } from "../db/schema";
import { and, eq, gt, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken";
import { authCookieOptions } from "../utils/cookieOptions";
import { hashPassword, comparePassword } from "../utils/password";
import { createVerificationToken, hashVerificationToken } from "../utils/verificationToken";
import { registerSchema, loginSchema, verifyQuerySchema } from "./authSchemas";
import { env } from "../config/env";

/**
 * Single message for every failed login, whatever the cause.
 *
 * Distinguishing "no such user" from "wrong password" would let anyone
 * enumerate registered accounts one request at a time.
 */
const INVALID_CREDENTIALS = "Invalid email or password";

/** Dummy hash used to keep the timing of a missing-user login honest. */
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
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(or(eq(users.email, email), eq(users.username, username)))
            .limit(1);

        const { token, tokenHash, expiresAt } = createVerificationToken();

        // Reuse one response for both outcomes so registration cannot be used to
        // probe which emails and usernames are taken.
        const acceptedResponse = {
            message:
                "If that email is available, a verification link has been sent. Please check your inbox.",
        };

        if (existingUser) {
            // Resend to the address on file rather than exposing the collision.
            // A username collision is not resent to — the address may belong to
            // someone else entirely.
            if (existingUser.email === email) {
                await db
                    .update(users)
                    .set({
                        verificationTokenHash: tokenHash,
                        verificationTokenExpires: expiresAt,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(users.id, existingUser.id), eq(users.isVerified, false)));

                console.log(`Verify link: ${env.SERVER_URL}/api/auth/verify?token=${token}`);
            }
            return res.status(202).json(acceptedResponse);
        }

        const passwordHash = await hashPassword(password);

        await db.insert(users).values({
            username,
            email,
            passwordHash,
            verificationTokenHash: tokenHash,
            verificationTokenExpires: expiresAt,
        });

        // Emailing is not wired up yet; the link goes to the server log for now.
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

        // Always run a bcrypt comparison, even with no user, so response time
        // does not reveal whether the address is registered.
        const validPassword = await comparePassword(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !validPassword) {
            return res.status(401).json({ message: INVALID_CREDENTIALS });
        }

        // Only after the password checks out is it safe to say anything specific:
        // at this point the caller has proven the account is theirs.
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

        // The UPDATE is the guard: matching on the token, the unverified state and
        // the expiry in one statement means concurrent requests cannot both pass a
        // separate check before either writes. Exactly one gets a row back.
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
                    // A null expiry never satisfies gt(), so rows missing one are
                    // treated as expired rather than valid forever.
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
