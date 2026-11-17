CREATE TABLE "routine_sets" (
	"routine_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"set_no" smallint NOT NULL,
	"weight_kg" numeric(4, 1) NOT NULL,
	"reps" smallint NOT NULL,
	CONSTRAINT "routine_sets_routine_id_exercise_id_set_no_pk" PRIMARY KEY("routine_id","exercise_id","set_no"),
	CONSTRAINT "routine_sets_position_ck" CHECK ("routine_sets"."position" between 1 and 99),
	CONSTRAINT "routine_sets_set_no_ck" CHECK ("routine_sets"."set_no" between 1 and 99),
	CONSTRAINT "routine_sets_weight_ck" CHECK ("routine_sets"."weight_kg" between 0 and 500 and ("routine_sets"."weight_kg" * 2) = trunc("routine_sets"."weight_kg" * 2)),
	CONSTRAINT "routine_sets_reps_ck" CHECK ("routine_sets"."reps" between 1 and 999)
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routines_name_ck" CHECK (char_length("routines"."name") between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "routine_sets" ADD CONSTRAINT "routine_sets_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_sets" ADD CONSTRAINT "routine_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "routines_user_name_uq" ON "routines" USING btree ("user_id",lower("name"));