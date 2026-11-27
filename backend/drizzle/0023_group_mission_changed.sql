ALTER TABLE "groups" ADD COLUMN "mission_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "mission_changed_by" text;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_mission_changed_by_users_id_fk" FOREIGN KEY ("mission_changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;