/**
 * Postgres error codes for constraint violations the API turns into 409s.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

/**
 * Whether a thrown query error is a Postgres error with the given code.
 *
 * Drizzle wraps driver errors in a DrizzleQueryError and keeps the original
 * pg error as `cause`, so both the error and its cause are checked.
 */
export const hasPgErrorCode = (error: unknown, code: string): boolean => {
    const candidates = [error, (error as { cause?: unknown } | null)?.cause];
    return candidates.some(
        (e) => typeof e === "object" && e !== null && (e as { code?: unknown }).code === code,
    );
};
