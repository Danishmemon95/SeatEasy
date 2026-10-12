import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { assertTestDatabase } from "./helpers/guard";

/** Runs once before the whole suite: checks the database, then migrates it. */
export default async function setup() {
    const pool = new Pool({ connectionString: assertTestDatabase() });
    try {
        await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    } finally {
        await pool.end();
    }
}
