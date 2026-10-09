import { env } from "../config/env";
import { takeSendSlot } from "./sendCap";

/**
 * The one place that sends mail. Brevo's transactional API is a single JSON
 * POST, so this uses Node's fetch instead of an SDK; switching provider later
 * only touches this file.
 *
 * Sending never throws to callers: a failed mail is logged and the request
 * that triggered it still succeeds (the user can always ask for a resend).
 */

export type Mail = {
    to: string;
    subject: string;
    html: string;
    text: string;
};

const BREVO_API = "https://api.brevo.com/v3";
const SEND_TIMEOUT_MS = 10_000;

const brevoHeaders = () => ({
    "api-key": env.BREVO_API_KEY!,
    "content-type": "application/json",
    accept: "application/json",
});

/** Returns true when the mail was handed to the provider (or printed). */
export const sendMail = async ({ to, subject, html, text }: Mail): Promise<boolean> => {
    try {
        if (!takeSendSlot()) {
            console.warn(`[mail] daily cap of ${env.MAIL_DAILY_CAP} reached; skipped "${subject}" to ${to}`);
            return false;
        }

        if (env.MAIL_TRANSPORT === "console") {
            console.log(`[mail] (console) To: ${to}\nSubject: ${subject}\n\n${text}\n[mail] end`);
            return true;
        }

        const response = await fetch(`${BREVO_API}/smtp/email`, {
            method: "POST",
            headers: brevoHeaders(),
            body: JSON.stringify({
                sender: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME },
                to: [{ email: to }],
                subject,
                htmlContent: html,
                textContent: text,
            }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error(`[mail] Brevo rejected "${subject}" to ${to}: ${response.status} ${body}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[mail] sending "${subject}" to ${to} failed:`, error);
        return false;
    }
};

/**
 * Boot check: with Brevo, confirm the API key works. Logged only, never fatal,
 * like the database check in server.ts.
 */
export const checkMailTransport = async () => {
    if (env.MAIL_TRANSPORT === "console") {
        console.log("[mail] transport: console (mails are printed, not sent)");
        return;
    }
    try {
        const response = await fetch(`${BREVO_API}/account`, {
            headers: brevoHeaders(),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (response.ok) {
            console.log(`[mail] transport: brevo, sending as ${env.MAIL_FROM_EMAIL}`);
        } else {
            const body = await response.text().catch(() => "");
            console.error(`[mail] Brevo key check failed: ${response.status} ${body}`);
        }
    } catch (error) {
        console.error("[mail] could not reach Brevo:", error);
    }
};
