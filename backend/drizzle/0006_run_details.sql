CREATE TABLE "run_details" (
	"record_id" uuid PRIMARY KEY NOT NULL,
	"distance_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	CONSTRAINT "run_details_distance_ck" CHECK ("run_details"."distance_m" between 100 and 200000),
	CONSTRAINT "run_details_duration_ck" CHECK ("run_details"."duration_s" between 60 and 86400)
);
--> statement-breakpoint
ALTER TABLE "run_details" ADD CONSTRAINT "run_details_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;