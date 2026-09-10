import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
