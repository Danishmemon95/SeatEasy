import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Loaded here, before any test imports src/config/env.ts: its dotenv.config()
// never overrides a variable that is already set, so these win over .env.
const { parsed } = dotenv.config({ path: ".env.test", override: true });

export default defineConfig({
    test: {
        env: parsed,
        include: ["tests/**/*.test.ts"],
        globalSetup: "./tests/globalSetup.ts",
        // Every file shares one database, so files run one at a time.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
});
