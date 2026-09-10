import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

pool.on("error", (err) => {
    console.error("Unexpected pool error", err);
});

export const db = drizzle(pool);
export default pool;
