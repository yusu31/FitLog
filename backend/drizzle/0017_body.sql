CREATE TABLE "body_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"measured_on" date NOT NULL,
	"kg" numeric(4, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_weights_kg_ck" CHECK ("body_weights"."kg" between 20 and 300)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "height_cm" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "favorite_kind" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_time" text;--> statement-breakpoint
ALTER TABLE "body_weights" ADD CONSTRAINT "body_weights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "body_weights_user_date_uq" ON "body_weights" USING btree ("user_id","measured_on");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_height_ck" CHECK ("users"."height_cm" is null or "users"."height_cm" between 100 and 250);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_bio_ck" CHECK ("users"."bio" is null or char_length("users"."bio") between 1 and 40);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_favorite_kind_ck" CHECK ("users"."favorite_kind" is null or "users"."favorite_kind" in ('workout', 'run', 'both'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_active_time_ck" CHECK ("users"."active_time" is null or "users"."active_time" in ('morning', 'noon', 'night'));