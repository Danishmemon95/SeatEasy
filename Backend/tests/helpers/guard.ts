/**
 * The suite truncates every table, so it must never run against a real
 * database. Returns the connection string, or throws unless the database name
 * ends in "_test".
 */
export const assertTestDatabase = (): string => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.test.example to .env.test.");

    const name = new URL(url).pathname.slice(1);
    if (!name.endsWith("_test")) {
        throw new Error(`Refusing to run tests against database "${name}": its name must end in "_test".`);
    }
    return url;
};
