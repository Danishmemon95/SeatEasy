import crypto from "crypto";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export const hashVerificationToken = (token: string): string =>
    crypto.createHash("sha256").update(token).digest("hex");

/**
 * A random token for an emailed link. The raw token goes in the mail; only its
 * sha256 hash is stored, so a database leak can't be replayed as links.
 */
export const createOneTimeToken = (ttlMs: number) => {
    const token = crypto.randomBytes(32).toString("hex");
    return {
        token,
        tokenHash: hashVerificationToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
    };
};

export const createVerificationToken = () => createOneTimeToken(VERIFICATION_TOKEN_TTL_MS);
