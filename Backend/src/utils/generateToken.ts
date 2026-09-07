import jwt from "jsonwebtoken";
import { Response } from "express";
import { authCookieOptions } from "./cookieOptions";

export const generateToken = (userId: number, res: Response) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
        expiresIn: "7d",
    });

    res.cookie("jwt", token, {
        ...authCookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return token;
}