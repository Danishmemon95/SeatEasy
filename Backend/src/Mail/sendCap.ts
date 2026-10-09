import { env } from "../config/env";

/**
 * Daily send cap, kept below Brevo's free-plan limit.
 *
 * In memory on purpose: Render runs one always-on process, so the count is
 * accurate there, and a restart only resets it, which makes the cap more
 * lenient, never stricter.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The calendar date in IST, so the counter rolls over at midnight IST.
const istDay = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

let day = istDay();
let sent = 0;

/** Counts one send and returns true, or returns false when today's cap is used up. */
export const takeSendSlot = (): boolean => {
    const today = istDay();
    if (today !== day) {
        day = today;
        sent = 0;
    }
    if (sent >= env.MAIL_DAILY_CAP) return false;
    sent += 1;
    return true;
};
