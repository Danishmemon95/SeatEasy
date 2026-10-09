import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// "KEY=" in an env file arrives as "", which should mean "not set" rather than fail validation.
const optional = <T extends z.ZodType>(schema: T) =>
    z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

/**
 * Validated environment. Importing this module is what enforces the contract:
 * anything missing or malformed crashes the process at startup rather than
 * surfacing as a confusing runtime error on the first request that needs it.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // 32 chars is the floor for a secret backing HS256 signatures.
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    CLIENT_URL: z.url().default("http://localhost:5173"),
    SERVER_URL: z.url().default("http://localhost:5000"),
    // Mail: "console" prints mails instead of sending, so the project runs without a Brevo key.
    MAIL_TRANSPORT: z.enum(["brevo", "console"]).default("console"),
    BREVO_API_KEY: optional(z.string()),
    MAIL_FROM_EMAIL: optional(z.email()),
    MAIL_FROM_NAME: optional(z.string()),
    // Kept below Brevo's ~300/day free limit so a flood never gets the key flagged.
    MAIL_DAILY_CAP: z.coerce.number().int().positive().default(250),
}).superRefine((value, ctx) => {
    // A half-filled Brevo config crashes at boot instead of at the first send.
    if (value.MAIL_TRANSPORT !== "brevo") return;
    for (const key of ["BREVO_API_KEY", "MAIL_FROM_EMAIL", "MAIL_FROM_NAME"] as const) {
        if (!value[key]) {
            ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when MAIL_TRANSPORT=brevo` });
        }
    }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("\n");
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
