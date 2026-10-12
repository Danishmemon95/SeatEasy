// Imported first so an invalid environment fails before anything else boots.
import { env } from "./config/env";
import app from "./app";
import pool from "./config/db";
import { checkMailTransport } from "./Mail/mailer";

app.listen(env.PORT, async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log(`Server is running on port ${env.PORT}`);
    } catch (error) {
        console.error("Database connection failed:", error);
    }
    await checkMailTransport();
});
