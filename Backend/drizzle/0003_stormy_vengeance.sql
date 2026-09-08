CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."user_roles" ADD VALUE 'admin' BEFORE 'organizer';--> statement-breakpoint
CREATE TABLE "org_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"description" text NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"approver_id" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "verification_token" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "org_applications" ADD CONSTRAINT "org_applications_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_applications" ADD CONSTRAINT "org_applications_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;