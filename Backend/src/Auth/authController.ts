import { Request, Response } from "express";
import { db } from "../config/db";
import { orgApplications, users } from "../db/schema";
import { and, eq, gt, or, type SQL } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken";
import { authCookieOptions } from "../utils/cookieOptions";
import { hashPassword, comparePassword } from "../utils/password";
import {
    PASSWORD_RESET_TOKEN_TTL_MS,
    createOneTimeToken,
    createVerificationToken,
    hashVerificationToken,
} from "../utils/verificationToken";
import {
    registerSchema,
    loginSchema,
    verifyQuerySchema,
    updateMeSchema,
    emailOnlySchema,
    resetPasswordSchema,
    changePasswordSchema,
} from "./authSchemas";
import { sendValidationError } from "../utils/validation";
import {
    sendPasswordChangedEmail,
    sendPasswordResetEmail,
    sendVerificationEmail,
} from "../Mail/accountMails";

const INVALID_CREDENTIALS = "Invalid email or password";

const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.LMB8Zt3aB0iZ0OqQvFB6vJPQXPvC";

/**
 * Gives the matching unverified user a fresh verification token and mails it.
 * Overwriting the stored hash is what makes any earlier link stop working.
 * Shared by register's "signed up again" branch and resend-verification.
 */
const rotateVerificationToken = async (match: SQL) => {
    const { token, tokenHash, expiresAt } = createVerificationToken();

    const [user] = await db
        .update(users)
        .set({
            verificationTokenHash: tokenHash,
            verificationTokenExpires: expiresAt,
            updatedAt: new Date(),
        })
        .where(and(match, eq(users.isVerified, false)))
        .returning({ username: users.username, email: users.email });

    if (user) sendVerificationEmail(user, token);
};

/**
 * The columns a password reset or change writes. Besides the new hash it:
 * - clears any pending reset link, so it can't be used afterwards
 * - stamps passwordChangedAt, which signs out every other session (protectRoute)
 * - verifies the email: a reset link opened from that inbox proves ownership
 */
const newPasswordFields = async (password: string) => ({
    passwordHash: await hashPassword(password),
    passwordResetTokenHash: null,
    passwordResetExpires: null,
    passwordChangedAt: new Date(),
    isVerified: true,
    verificationTokenHash: null,
    verificationTokenExpires: null,
    updatedAt: new Date(),
});

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

            await rotateVerificationToken(eq(users.id, existingUser.id));
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

        sendVerificationEmail({ username, email }, token);

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
                city: users.city,
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
                city: users.city,
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


/**
 * PATCH /api/auth/me  { city }
 * Saves the user's city every time they change it in the city picker, and
 * returns the same user shape as checkAuth so the client can update its
 * session cache directly.
 */
export const updateMe = async (req: Request, res: Response) => {
    try {
        const parsed = updateMeSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid profile details");

        const [user] = await db
            .update(users)
            .set({ city: parsed.data.city, updatedAt: new Date() })
            .where(eq(users.id, req.user!.id))
            .returning({
                id: users.id,
                username: users.username,
                email: users.email,
                role: users.role,
                isVerified: users.isVerified,
                city: users.city,
            });

        if (!user) return res.status(401).json({ message: "Unauthorized - Session no longer valid" });

        res.status(200).json({ success: true, message: "Profile updated", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// One answer whether or not the email has an account, so these endpoints can't
// be used to find out who is registered.
const RESEND_ACCEPTED = {
    message: "If that email belongs to an unverified account, a new verification link has been sent.",
};
const FORGOT_ACCEPTED = {
    message: "If an account exists for that email, a password reset link has been sent.",
};

/**
 * POST /api/auth/resend-verification  { email }
 * Mails a new verification link to an unverified account; the old link stops working.
 */
export const resendVerification = async (req: Request, res: Response) => {
    try {
        const parsed = emailOnlySchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid email");

        await rotateVerificationToken(eq(users.email, parsed.data.email));

        return res.status(202).json(RESEND_ACCEPTED);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * POST /api/auth/forgot-password  { email }
 * Stores a 30-minute reset token (replacing any earlier one) and mails the
 * link. Works for unverified accounts too: completing the reset verifies them.
 */
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const parsed = emailOnlySchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid email");

        const { token, tokenHash, expiresAt } = createOneTimeToken(PASSWORD_RESET_TOKEN_TTL_MS);

        const [user] = await db
            .update(users)
            .set({
                passwordResetTokenHash: tokenHash,
                passwordResetExpires: expiresAt,
                updatedAt: new Date(),
            })
            .where(eq(users.email, parsed.data.email))
            .returning({ username: users.username, email: users.email });

        if (user) sendPasswordResetEmail(user, token);

        return res.status(202).json(FORGOT_ACCEPTED);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * POST /api/auth/reset-password  { token, password }
 * One UPDATE both checks the token and consumes it, so a link works exactly
 * once even if two requests race. Doesn't sign the user in: the page sends
 * them to login with the new password.
 */
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const parsed = resetPasswordSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid reset details");

        const { token, password } = parsed.data;

        const [user] = await db
            .update(users)
            .set(await newPasswordFields(password))
            .where(
                and(
                    eq(users.passwordResetTokenHash, hashVerificationToken(token)),
                    gt(users.passwordResetExpires, new Date()),
                ),
            )
            .returning({ username: users.username, email: users.email });

        if (!user) {
            return res.status(400).json({
                message: "This reset link is invalid or has expired. Please request a new one.",
                code: "RESET_LINK_INVALID",
            });
        }

        sendPasswordChangedEmail(user);

        return res.status(200).json({ message: "Password reset. Please sign in with your new password." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * PATCH /api/auth/me/password  { currentPassword, newPassword }
 * Signed in. Re-issues this device's cookie after the change, so this session
 * stays signed in while every other one is rejected by protectRoute.
 */
export const changePassword = async (req: Request, res: Response) => {
    try {
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error, "Invalid password details");

        const { currentPassword, newPassword } = parsed.data;
        const userId = req.user!.id;

        const [current] = await db
            .select({ passwordHash: users.passwordHash })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!current) return res.status(401).json({ message: "Unauthorized - Session no longer valid" });

        // 400 rather than 401: the session is fine, only the typed password is wrong.
        if (!(await comparePassword(currentPassword, current.passwordHash))) {
            return res.status(400).json({
                message: "Current password is incorrect",
                errors: [{ field: "currentPassword", message: "Current password is incorrect" }],
            });
        }

        const [user] = await db
            .update(users)
            .set(await newPasswordFields(newPassword))
            .where(eq(users.id, userId))
            .returning({ username: users.username, email: users.email });

        if (!user) return res.status(401).json({ message: "Unauthorized - Session no longer valid" });

        generateToken(userId, res);
        sendPasswordChangedEmail(user);

        return res.status(200).json({ message: "Password changed. Other devices were signed out." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};
