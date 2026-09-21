ALTER TABLE "users" RENAME COLUMN "verification_token" TO "verification_token_hash";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "verification_token_expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_verification_token_hash_idx" ON "users" USING btree ("verification_token_hash");