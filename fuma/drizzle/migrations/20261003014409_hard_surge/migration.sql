CREATE TABLE `page_bodies` (
	`hash` text PRIMARY KEY,
	`markdown` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_ref` (
	`sync_run_id` integer NOT NULL,
	`datasource_id` integer NOT NULL,
	`revision_id` text NOT NULL,
	`url` text NOT NULL,
	`published_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_versions` (
	`revision_id` text PRIMARY KEY,
	`source_key` text NOT NULL,
	`source_hash` text NOT NULL,
	`url` text NOT NULL,
	`content_hash` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text,
	`metadata` text,
	`filename` text,
	`ext` text,
	`published_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_page_versions_content_hash_page_bodies_hash_fk` FOREIGN KEY (`content_hash`) REFERENCES `page_bodies`(`hash`)
);
--> statement-breakpoint
CREATE TABLE `page_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`revision_id` text NOT NULL,
	`heading_id` text,
	`heading_title` text,
	`content` text NOT NULL,
	`ordinal` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `datasources` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text,
	`mounted_path` text NOT NULL,
	`sort_order` integer NOT NULL,
	`tree` text NOT NULL,
	`sync_run_id` integer
);
--> statement-breakpoint
CREATE TABLE `source_heads` (
	`id` text PRIMARY KEY,
	`sync_run_id` integer NOT NULL,
	`search_slot` text DEFAULT 'a' NOT NULL,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`base_run_id` integer,
	`datasource_ids` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error` text,
	CONSTRAINT `fk_sync_runs_base_run_id_sync_runs_id_fk` FOREIGN KEY (`base_run_id`) REFERENCES `sync_runs`(`id`)
);
--> statement-breakpoint
CREATE INDEX `page_ref_date_url` ON `page_ref` (`published_at`,`url`,`sync_run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_versions_source_build` ON `page_versions` (`source_key`,`source_hash`);--> statement-breakpoint
CREATE INDEX `page_versions_datasource_date` ON `page_versions` (`published_at`,`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_sections_revision_order` ON `page_sections` (`revision_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `page_sections_revision` ON `page_sections` (`revision_id`);--> statement-breakpoint
CREATE INDEX `datasource_snapshots_datasource` ON `datasources` (`slug`);--> statement-breakpoint
CREATE INDEX `sync_runs_status_created` ON `sync_runs` (`status`,`created_at`);