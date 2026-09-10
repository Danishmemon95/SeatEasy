import jwt from "jsonwebtoken";
import { Response } from "express";
import { authCookieOptions } from "./cookieOptions";
import { env } from "../config/env";

export const JWT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const generateToken = (userId: number, res: Response) => {
    // env.JWT_SECRET is validated at startup, so this can never sign with undefined.
    const token = jwt.sign({ userId }, env.JWT_SECRET, {
        expiresIn: "7d",
    });

    res.cookie("jwt", token, {
        ...authCookieOptions,
        maxAge: JWT_TTL_MS,
    });

    return token;
};
