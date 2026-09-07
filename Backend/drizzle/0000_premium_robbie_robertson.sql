CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"dob" date,
	"address" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_token" varchar(255),
	"verification_token_expires" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
