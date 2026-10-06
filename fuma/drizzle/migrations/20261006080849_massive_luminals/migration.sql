PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page_versions` (
	`revision_id` text PRIMARY KEY,
	`source_key` text NOT NULL,
	`source_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text,
	`metadata` text,
	`filename` text,
	`ext` text,
	`published_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_page_versions`(`revision_id`, `source_key`, `source_hash`, `url`, `content_hash`, `title`, `description`, `tags`, `metadata`, `filename`, `ext`, `published_at`) SELECT `revision_id`, `source_key`, `source_hash`, `url`, `content_hash`, `title`, `description`, `tags`, `metadata`, `filename`, `ext`, `published_at` FROM `page_versions`;--> statement-breakpoint
DROP TABLE `page_versions`;--> statement-breakpoint
ALTER TABLE `__new_page_versions` RENAME TO `page_versions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page_ref` (
	`sync_run_id` integer NOT NULL,
	`datasource_id` integer NOT NULL,
	`revision_id` text NOT NULL,
	`url` text NOT NULL,
	`published_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_page_ref`(`sync_run_id`, `datasource_id`, `revision_id`, `url`, `published_at`) SELECT `sync_run_id`, `datasource_id`, `revision_id`, `url`, `published_at` FROM `page_ref`;--> statement-breakpoint
DROP TABLE `page_ref`;--> statement-breakpoint
ALTER TABLE `__new_page_ref` RENAME TO `page_ref`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_source_heads` (
	`id` text PRIMARY KEY,
	`sync_run_id` integer,
	`search_slot` text,
	`published_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_source_heads`(`id`, `sync_run_id`, `search_slot`, `published_at`) SELECT `id`, `sync_run_id`, `search_slot`, `published_at` FROM `source_heads`;--> statement-breakpoint
DROP TABLE `source_heads`;--> statement-breakpoint
ALTER TABLE `__new_source_heads` RENAME TO `source_heads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`base_run_id` integer,
	`datasource_ids` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error` text
);
--> statement-breakpoint
INSERT INTO `__new_sync_runs`(`id`, `base_run_id`, `datasource_ids`, `status`, `created_at`, `started_at`, `finished_at`, `error`) SELECT `id`, `base_run_id`, `datasource_ids`, `status`, `created_at`, `started_at`, `finished_at`, `error` FROM `sync_runs`;--> statement-breakpoint
DROP TABLE `sync_runs`;--> statement-breakpoint
ALTER TABLE `__new_sync_runs` RENAME TO `sync_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `datasource_slug_index`;--> statement-breakpoint
CREATE UNIQUE INDEX `page_versions_source_build` ON `page_versions` (`source_key`,`source_hash`);--> statement-breakpoint
CREATE INDEX `page_versions_datasource_date` ON `page_versions` (`published_at`,`url`);--> statement-breakpoint
CREATE INDEX `page_ref_date_url` ON `page_ref` (`published_at`,`url`,`sync_run_id`);--> statement-breakpoint
CREATE INDEX `sync_runs_status_created` ON `sync_runs` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `datasource_slug_run_index` ON `datasources` (`slug`,`sync_run_id`);