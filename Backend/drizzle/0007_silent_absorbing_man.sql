-- Hand-edited: clear the pre-ownership test data first. Venues now need an
-- owner, shows need type/language/duration/rating, screenings need an end time
-- and bookings need a screening; none of that can be backfilled meaningfully,
-- and the NOT NULL columns below cannot be added while rows exist. Users and
-- org applications are untouched. Order follows the foreign keys.
DELETE FROM "screening_seats";--> statement-breakpoint
DELETE FROM "bookings";--> statement-breakpoint
DELETE FROM "screenings";--> statement-breakpoint
DELETE FROM "shows";--> statement-breakpoint
DELETE FROM "seats";--> statement-breakpoint
DELETE FROM "venues";--> statement-breakpoint
CREATE TYPE "public"."age_rating" AS ENUM('U', 'UA', 'A');--> statement-breakpoint
CREATE TYPE "public"."screening_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."show_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."show_type" AS ENUM('movie', 'concert', 'play', 'comedy', 'sports', 'other');--> statement-breakpoint
CREATE TABLE "screening_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"screening_id" integer NOT NULL,
	"category" "seat_category" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "screening_prices_screening_category_unique" UNIQUE("screening_id","category")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "screening_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "ends_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "status" "screening_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "type" "show_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "genre" varchar(50);--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "language" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "duration_minutes" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "age_rating" "age_rating" NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "poster_url" text;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "status" "show_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "screening_prices" ADD CONSTRAINT "screening_prices_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_screening_id_idx" ON "bookings" USING btree ("screening_id");--> statement-breakpoint
CREATE INDEX "screenings_venue_starts_at_idx" ON "screenings" USING btree ("venue_id","starts_at");--> statement-breakpoint
CREATE INDEX "screenings_show_id_idx" ON "screenings" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "shows_org_id_idx" ON "shows" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "venues_owner_id_idx" ON "venues" USING btree ("owner_id");