ALTER TYPE "public"."record_kind" ADD VALUE 'post';--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_caption_ck" CHECK ("records"."caption" is null or char_length("records"."caption") between 1 and 50);