import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import pool from "./config/db"
import authRoutes from "./Auth/authRoutes"
import cookieParser from "cookie-parser"

dotenv.config()
const app = express()

const PORT = process.env.PORT || 5000

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes)

app.listen(PORT, async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log(`Server is running on port ${PORT}`);
    } catch (error) {
        console.error("Database connection failed:", error);
    }
});
