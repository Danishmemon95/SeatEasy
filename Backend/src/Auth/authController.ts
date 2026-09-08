import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../config/db"
import { users } from "../db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken";
import { authCookieOptions } from "../utils/cookieOptions";



export const register = async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "username, email and password are required" });
        }

        const existingUser = await db.select().from(users).where(or(eq(users.email, email), eq(users.username, username)));

        if (existingUser.length > 0) {
            return res.status(400).json({ message: `The entered ${email} or ${username} already exists` });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const [newUser] = await db.insert(users).values({ username, email, passwordHash, verificationToken, verificationTokenExpires })
            .returning({ id: users.id, username: users.username, email: users.email })

        if (newUser) {
            console.log(`Verify link: http://localhost:5000/api/auth/verify?token=${verificationToken}`);
            return res.status(201).json({ message: "User registered successfully", user: newUser });
        }


    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}



export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Please provide your email" });
        }

        if (!password) {
            return res.status(400).json({ message: "Please provide your password" });
        }

        const [user] = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
            isVerified: users.isVerified,
            passwordHash: users.passwordHash,
        }).from(users).where(or(eq(users.email, email)));

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        if (!user.isVerified) {
            return res.status(401).json({ message: "User not verified" });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid password" });
        }

        if (user) {
            generateToken(user.id, res);
            const { passwordHash, ...safeUser } = user;
            return res.status(200).json({ message: "Login successful", user: safeUser });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}



export const logout = async (req: Request, res: Response) => {
    try {
        res.clearCookie("jwt", authCookieOptions);
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}



export const verifyUser = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }

        const [user] = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            isVerified: users.isVerified,
            verificationToken: users.verificationToken,
            verificationTokenExpires: users.verificationTokenExpires,
            role: users.role,
        }).from(users).where(eq(users.verificationToken, token as string));

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User already verified" });
        }

        if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
            return res.status(400).json({ message: "Token has expired" });
        }

        await db.update(users).set({ isVerified: true, verificationToken: null, verificationTokenExpires: null }).where(eq(users.id, user.id));

        generateToken(user.id, res);

        return res.status(200).json({ message: "Email verified successfully", user: { id: user.id, username: user.username, email: user.email, role: user.role } });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


export const checkAuth = async (req: Request, res: Response) => {
    try {
        res.status(200).json({ success: true, message: "Authenticated", user: req.user });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}