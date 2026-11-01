CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"set_no" smallint NOT NULL,
	"weight_kg" numeric(4, 1) NOT NULL,
	"reps" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_sets_set_no_ck" CHECK ("workout_sets"."set_no" between 1 and 99),
	CONSTRAINT "workout_sets_weight_ck" CHECK ("workout_sets"."weight_kg" between 0 and 500 and ("workout_sets"."weight_kg" * 2) = trunc("workout_sets"."weight_kg" * 2)),
	CONSTRAINT "workout_sets_reps_ck" CHECK ("workout_sets"."reps" between 1 and 999)
);
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sets_record_exercise_set_uq" ON "workout_sets" USING btree ("record_id","exercise_id","set_no");--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_record_idx" ON "workout_sets" USING btree ("exercise_id","record_id");