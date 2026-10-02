import { z } from "zod";

const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(72, "Password cannot exceed 72 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username cannot exceed 30 characters")
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Username can only contain letters, numbers, hyphens, and underscores",
        ),
    email: z.email("Please enter a valid email address").trim().toLowerCase().max(150),
    password: passwordSchema,
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().min(1, "Please provide your email"),
    password: z.string().min(1, "Please provide your password"),
});

export const verifyQuerySchema = z.object({
    token: z
        .string()
        .min(1, "Token is required")
        .regex(/^[a-f0-9]{64}$/, "Malformed verification token"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
