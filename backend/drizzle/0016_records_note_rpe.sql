ALTER TABLE "records" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "rpe" smallint;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_note_ck" CHECK ("records"."note" is null or char_length("records"."note") between 1 and 200);--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_rpe_ck" CHECK ("records"."rpe" is null or "records"."rpe" between 1 and 10);