ALTER TABLE "permanent_profile" ADD COLUMN "residence_country" text;--> statement-breakpoint
ALTER TABLE "permanent_profile" ADD COLUMN "residence_visa_status" text;--> statement-breakpoint
ALTER TABLE "permanent_profile" ADD COLUMN "citizenships_v2" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "permanent_profile" SET "residence_country" = "home_country" WHERE "home_country" IS NOT NULL;--> statement-breakpoint
UPDATE "permanent_profile" SET "citizenships_v2" = COALESCE((SELECT jsonb_agg(jsonb_build_object('country', c, 'passportExpiry', NULL)) FROM unnest("citizenships") AS c), '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "permanent_profile" DROP COLUMN "home_country";--> statement-breakpoint
ALTER TABLE "permanent_profile" DROP COLUMN "citizenships";--> statement-breakpoint
ALTER TABLE "permanent_profile" RENAME COLUMN "citizenships_v2" TO "citizenships";
