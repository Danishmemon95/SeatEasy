ALTER TABLE "seats" DROP CONSTRAINT "seats_venue_id_venues_id_fk";
--> statement-breakpoint
-- Hand-edited: existing seat numbers like "A12" are split into row "A" and
-- number 12 before the column changes type. A value that does not fit that
-- shape leaves row_label null and the SET NOT NULL below fails, rather than
-- silently producing a wrong seat.
ALTER TABLE "seats" ADD COLUMN "row_label" varchar(3);--> statement-breakpoint
UPDATE "seats" SET "row_label" = upper(substring("seat_number" from '^([A-Za-z]{1,3})[0-9]+$'));--> statement-breakpoint
ALTER TABLE "seats" ALTER COLUMN "row_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seats" ALTER COLUMN "seat_number" SET DATA TYPE integer USING substring("seat_number" from '[0-9]+$')::integer;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_venue_row_number_unique" UNIQUE("venue_id","row_label","seat_number");
