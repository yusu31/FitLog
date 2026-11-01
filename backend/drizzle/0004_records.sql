CREATE TYPE "public"."record_kind" AS ENUM('workout', 'run', 'rest');--> statement-breakpoint
CREATE TABLE "records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "record_kind" NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "records_user_local_date_idx" ON "records" USING btree ("user_id","local_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "records_user_recorded_at_idx" ON "records" USING btree ("user_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "records_rest_per_day_uq" ON "records" USING btree ("user_id","local_date") WHERE "records"."kind" = 'rest';