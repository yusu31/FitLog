ALTER TABLE "groups" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "background" text DEFAULT 'yard' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_description_ck" CHECK ("groups"."description" is null or char_length("groups"."description") between 1 and 100);--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_background_ck" CHECK ("groups"."background" in ('yard', 'gym', 'park', 'city'));