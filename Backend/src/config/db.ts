import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";

dotenv.config()

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
    console.error("Unexpected pool error", err);
});

pool.on("connect", () => {
    console.log("Connected to database");
});

export const db = drizzle(pool);
export default pool