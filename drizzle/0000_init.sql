CREATE TYPE "public"."condition_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."condition_source" AS ENUM('seed', 'ai');--> statement-breakpoint
CREATE TYPE "public"."idp_convention" AS ENUM('1949', '1968');--> statement-breakpoint
CREATE TYPE "public"."trip_purpose" AS ENUM('tourism', 'business', 'family', 'study');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planning', 'booked', 'active', 'past');--> statement-breakpoint
CREATE TABLE "condition_row" (
	"row_type" text NOT NULL,
	"row_key" text NOT NULL,
	"data" jsonb NOT NULL,
	"source" "condition_source" NOT NULL,
	"confidence" "condition_confidence",
	"citations" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "condition_row_row_type_row_key_pk" PRIMARY KEY("row_type","row_key")
);
--> statement-breakpoint
CREATE TABLE "leg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"from_country" text NOT NULL,
	"to_country" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permanent_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"citizenships" text[] DEFAULT '{}' NOT NULL,
	"home_country" text,
	"idp_convention" "idp_convention",
	"idp_expiry" date,
	"controlled_meds" text[] DEFAULT '{}' NOT NULL,
	"has_minors" boolean DEFAULT false NOT NULL,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "trip_status" DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_context" (
	"trip_id" uuid PRIMARY KEY NOT NULL,
	"traveling_with_minors" boolean DEFAULT false NOT NULL,
	"driving_at_destination" boolean DEFAULT false NOT NULL,
	"carrying_controlled_meds" boolean DEFAULT false NOT NULL,
	"purpose" "trip_purpose",
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "leg" ADD CONSTRAINT "leg_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_profile" ADD CONSTRAINT "permanent_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_context" ADD CONSTRAINT "trip_context_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leg_trip_seq_unique" ON "leg" USING btree ("trip_id","seq");