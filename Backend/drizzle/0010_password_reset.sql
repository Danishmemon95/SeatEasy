ALTER TABLE "users" ADD COLUMN "password_reset_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_password_reset_token_hash_idx" ON "users" USING btree ("password_reset_token_hash");