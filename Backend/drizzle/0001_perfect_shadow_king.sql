CREATE TYPE "public"."seat_category" AS ENUM('gold', 'platinum', 'sofa');--> statement-breakpoint
CREATE TYPE "public"."user_roles" AS ENUM('organizer', 'buyer');--> statement-breakpoint
CREATE TABLE "seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"seat_number" varchar(10) NOT NULL,
	"venue_id" integer NOT NULL,
	"category" "seat_category" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_roles" DEFAULT 'buyer' NOT NULL;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;