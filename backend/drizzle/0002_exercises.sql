CREATE TYPE "public"."body_part" AS ENUM('chest', 'back', 'shoulders', 'arms', 'abs', 'glutes', 'legs');--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"body_part" "body_part" NOT NULL,
	"created_by" text,
	"trial_weight_kg" numeric(4, 1),
	"trial_reps" smallint,
	CONSTRAINT "exercises_trial_pair_ck" CHECK (("exercises"."trial_weight_kg" is null) = ("exercises"."trial_reps" is null))
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercises_created_by_idx" ON "exercises" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_created_by_name_uq" ON "exercises" USING btree ("created_by",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_common_name_uq" ON "exercises" USING btree (lower("name")) WHERE "exercises"."created_by" is null;