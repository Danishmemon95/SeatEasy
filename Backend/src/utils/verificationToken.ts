import crypto from "crypto";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const hashVerificationToken = (token: string): string =>
    crypto.createHash("sha256").update(token).digest("hex");


export const createVerificationToken = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return {
        token,
        tokenHash: hashVerificationToken(token),
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    };
};
