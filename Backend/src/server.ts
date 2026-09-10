// Imported first so an invalid environment fails before anything else boots.
import { env } from "./config/env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pool from "./config/db";
import authRoutes from "./Auth/authRoutes";

const app = express();

// Render and similar hosts sit behind a proxy; without this req.ip is the
// proxy's address and every client shares one rate-limit bucket.
app.set("trust proxy", 1);

app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
}));

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.listen(env.PORT, async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log(`Server is running on port ${env.PORT}`);
    } catch (error) {
        console.error("Database connection failed:", error);
    }
});
