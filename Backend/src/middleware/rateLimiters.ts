import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { isProduction } from "../config/env";

/**
 * Rate limits for the auth surface.
 *
 * Login and register both run bcrypt, which pins ~100ms of CPU per call, so
 * these caps are as much about keeping the process responsive as about slowing
 * credential stuffing.
 *
 * Limits are relaxed outside production so local development and manual testing
 * don't lock you out of your own server.
 */

const scale = (production: number, development: number) =>
    isProduction ? production : development;

const jsonMessage = (message: string) => ({ message });

/** Login: the credential-stuffing surface. Keyed on IP + submitted email so one
 *  attacker cannot lock every account behind a shared NAT, and spraying many
 *  accounts from one IP still gets throttled by the global limiter below. */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: scale(10, 100),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
        const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
        // ipKeyGenerator normalises IPv6 to a /64 subnet; a bare req.ip lets an
        // attacker with an IPv6 range trivially sidestep the limit.
        return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
    },
    message: jsonMessage("Too many login attempts. Please try again later."),
});

/** Registration: throttles automated account creation and the bcrypt hash it
 *  triggers. Keyed on IP alone — there is no prior identity to key on. */
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: scale(5, 100),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: jsonMessage("Too many accounts created from this address. Please try again later."),
});

/** Verification: the token is unguessable, so this exists to stop someone
 *  grinding the endpoint rather than to protect any one account. */
export const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: scale(20, 200),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: jsonMessage("Too many verification attempts. Please try again later."),
});

/** Backstop across the whole auth router, catching distribution across the
 *  per-route limiters above. */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: scale(50, 500),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: jsonMessage("Too many requests. Please try again later."),
});
