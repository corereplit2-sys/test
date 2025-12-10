CREATE TABLE "bookings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"credits_charged" double precision NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" varchar PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "currency_drive_scans" (
	"id" varchar PRIMARY KEY NOT NULL,
	"drive_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currency_drive_scans_drive_id_user_id_unique" UNIQUE("drive_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "currency_drives" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"date" date NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scans" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "currency_drives_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drive_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"vehicle_type" text NOT NULL,
	"vehicle_no" text,
	"date" date NOT NULL,
	"initial_mileage_km" double precision,
	"final_mileage_km" double precision,
	"distance_km" double precision NOT NULL,
	"is_from_qr_scan" text DEFAULT 'false' NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_qualifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"vehicle_type" text NOT NULL,
	"qualified_on_date" date NOT NULL,
	"last_drive_date" date,
	"currency_expiry_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ippt_attempts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"date" date NOT NULL,
	"situps" integer NOT NULL,
	"pushups" integer NOT NULL,
	"run_time_seconds" integer NOT NULL,
	"total_score" integer NOT NULL,
	"result" text NOT NULL,
	"is_initial" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ippt_scoring_compact" (
	"id" serial PRIMARY KEY NOT NULL,
	"age_group" text NOT NULL,
	"situps_scoring" text NOT NULL,
	"pushups_scoring" text NOT NULL,
	"run_scoring" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ippt_scoring_compact_age_group_unique" UNIQUE("age_group")
);
--> statement-breakpoint
CREATE TABLE "ippt_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"total_attendees" integer DEFAULT 0 NOT NULL,
	"avg_score" double precision DEFAULT 0 NOT NULL,
	"gold_count" integer DEFAULT 0 NOT NULL,
	"silver_count" integer DEFAULT 0 NOT NULL,
	"pass_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "msps" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "msps_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_eligibility" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"is_eligible" text DEFAULT 'true' NOT NULL,
	"reason" text,
	"ineligibility_type" text,
	"until_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_eligibility_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"credits" double precision DEFAULT 0 NOT NULL,
	"rank" text,
	"msp_id" text,
	"dob" date NOT NULL,
	"doe" date,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_drive_scans" ADD CONSTRAINT "currency_drive_scans_drive_id_currency_drives_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."currency_drives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_drive_scans" ADD CONSTRAINT "currency_drive_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_drives" ADD CONSTRAINT "currency_drives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_logs" ADD CONSTRAINT "drive_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_qualifications" ADD CONSTRAINT "driver_qualifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ippt_attempts" ADD CONSTRAINT "ippt_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ippt_attempts" ADD CONSTRAINT "ippt_attempts_session_id_ippt_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ippt_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_eligibility" ADD CONSTRAINT "user_eligibility_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_msp_id_msps_id_fk" FOREIGN KEY ("msp_id") REFERENCES "public"."msps"("id") ON DELETE set null ON UPDATE no action;