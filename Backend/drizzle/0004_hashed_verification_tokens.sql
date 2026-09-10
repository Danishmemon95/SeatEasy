-- Replace the plaintext verification token with a SHA-256 hash of it.
--
-- Deliberately a DROP + ADD rather than a rename: the existing column holds raw
-- tokens, and carrying those over would leave values that are not hashes sitting
-- in a column the application now compares hashes against. Any pending
-- verification link is invalidated by this change; unverified users need a new
-- one, which registering again with the same address will send.
ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_token";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token_hash" varchar(64);--> statement-breakpoint

-- Expiries are compared against NOW(); storing them without a zone would make
-- that comparison depend on the server's local time.
ALTER TABLE "users" ALTER COLUMN "verification_token_expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint

-- Lookup during verification is by hash, so it needs an index. Partial, because
-- rows for already-verified users hold NULL here and never need to be scanned.
CREATE INDEX IF NOT EXISTS "users_verification_token_hash_idx"
    ON "users" ("verification_token_hash")
    WHERE "verification_token_hash" IS NOT NULL;
