CREATE SCHEMA "mdark";
--> statement-breakpoint
CREATE TABLE "mdark"."cache" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" jsonb,
	"inserted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."comments" (
	"id" serial PRIMARY KEY,
	"page" varchar(256) NOT NULL,
	"thread" integer,
	"author" varchar(256) NOT NULL,
	"content" jsonb NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."rates" (
	"userId" varchar(256),
	"commentId" integer,
	"like" boolean NOT NULL,
	CONSTRAINT "rates_pkey" PRIMARY KEY("userId","commentId")
);
--> statement-breakpoint
CREATE TABLE "mdark"."roles" (
	"userId" varchar(256) PRIMARY KEY,
	"name" varchar(256) NOT NULL,
	"canDelete" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."accounts" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."sessions" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."verifications" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."page_bodies" (
	"hash" text PRIMARY KEY,
	"markdown" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."page_ref" (
	"sync_run_id" integer NOT NULL,
	"datasource_id" integer NOT NULL,
	"revision_id" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."page_versions" (
	"revision_id" text PRIMARY KEY,
	"source_key" text NOT NULL,
	"source_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"tags" jsonb,
	"metadata" jsonb,
	"filename" text,
	"ext" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."page_sections" (
	"id" serial PRIMARY KEY,
	"revision_id" text NOT NULL,
	"heading_id" text,
	"heading_title" text,
	"content" text NOT NULL,
	"ordinal" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mdark"."datasources" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text,
	"mounted_path" text NOT NULL,
	"sort_order" integer NOT NULL,
	"tree" jsonb,
	"sync_run_id" integer
);
--> statement-breakpoint
CREATE TABLE "mdark"."source_heads" (
	"id" text PRIMARY KEY,
	"sync_run_id" integer,
	"search_slot" text,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mdark"."sync_runs" (
	"id" serial PRIMARY KEY,
	"base_run_id" integer,
	"datasource_ids" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "cache_key_idx" ON "mdark"."cache" ("key");--> statement-breakpoint
CREATE INDEX "comment_idx" ON "mdark"."rates" ("commentId");--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "mdark"."accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "mdark"."sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "mdark"."verifications" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "page_ref_run_url" ON "mdark"."page_ref" ("sync_run_id","url");--> statement-breakpoint
CREATE INDEX "page_ref_run_date_url" ON "mdark"."page_ref" ("sync_run_id","published_at","url");--> statement-breakpoint
CREATE INDEX "page_ref_run_ds_date_url" ON "mdark"."page_ref" ("sync_run_id","datasource_id","published_at","url");--> statement-breakpoint
CREATE UNIQUE INDEX "page_versions_source_build" ON "mdark"."page_versions" ("source_key","source_hash");--> statement-breakpoint
CREATE INDEX "page_versions_datasource_date" ON "mdark"."page_versions" ("published_at","url");--> statement-breakpoint
CREATE UNIQUE INDEX "page_sections_revision_order" ON "mdark"."page_sections" ("revision_id","ordinal");--> statement-breakpoint
CREATE INDEX "page_sections_revision" ON "mdark"."page_sections" ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "datasource_slug_run_index" ON "mdark"."datasources" ("slug","sync_run_id");--> statement-breakpoint
CREATE INDEX "sync_runs_status_created" ON "mdark"."sync_runs" ("status","created_at");--> statement-breakpoint
ALTER TABLE "mdark"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "mdark"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mdark"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "mdark"."users"("id") ON DELETE CASCADE;