CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_body_ck" CHECK (char_length("comments"."body") between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"stamp_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_record_created_at_idx" ON "comments" USING btree ("record_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_record_user_stamp_uq" ON "reactions" USING btree ("record_id","user_id","stamp_key");