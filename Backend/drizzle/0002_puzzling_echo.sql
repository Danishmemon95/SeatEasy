CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('available', 'held', 'booked');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screening_seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"screening_id" integer NOT NULL,
	"seat_id" integer NOT NULL,
	"booking_id" integer,
	"price" numeric(10, 2) NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"held_until" timestamp with time zone,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "screening_seat_unique" UNIQUE("screening_id","seat_id")
);
--> statement-breakpoint
CREATE TABLE "screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"show_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_seats" ADD CONSTRAINT "screening_seats_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_seats" ADD CONSTRAINT "screening_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_seats" ADD CONSTRAINT "screening_seats_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shows" ADD CONSTRAINT "shows_org_id_users_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;