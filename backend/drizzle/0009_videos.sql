CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"visible_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_record_id_unique" UNIQUE("record_id"),
	CONSTRAINT "videos_size_ck" CHECK ("videos"."size_bytes" between 1 and 10485760)
);
--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;