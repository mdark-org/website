CREATE TABLE `page_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`revision_id` text NOT NULL,
	`heading_id` text,
	`heading_title` text,
	`content` text NOT NULL,
	`ordinal` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `source_heads` ADD `search_slot` text DEFAULT 'a' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page_ref` (
	`sync_run_id` integer NOT NULL,
	`datasource_id` integer NOT NULL,
	`revision_id` text NOT NULL,
	`url` text NOT NULL,
	`published_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_page_ref`(`sync_run_id`, `datasource_id`, `revision_id`, `url`, `published_at`) SELECT `sync_run_id`, `datasource_id`, `revision_id`, `url`, `published_at` FROM `page_ref`;--> statement-breakpoint
DROP TABLE `page_ref`;--> statement-breakpoint
ALTER TABLE `__new_page_ref` RENAME TO `page_ref`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_datasources` (
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
INSERT INTO `__new_datasources`(`id`, `slug`, `name`, `description`, `icon`, `mounted_path`, `sort_order`, `tree`, `sync_run_id`) SELECT `id`, `slug`, `name`, `description`, `icon`, `mounted_path`, `sort_order`, `tree`, `sync_run_id` FROM `datasources`;--> statement-breakpoint
DROP TABLE `datasources`;--> statement-breakpoint
ALTER TABLE `__new_datasources` RENAME TO `datasources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_source_heads` (
	`id` text PRIMARY KEY,
	`sync_run_id` integer NOT NULL,
	`search_slot` text DEFAULT 'a' NOT NULL,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_source_heads`(`id`, `sync_run_id`, `published_at`) SELECT `id`, `sync_run_id`, `published_at` FROM `source_heads`;--> statement-breakpoint
DROP TABLE `source_heads`;--> statement-breakpoint
ALTER TABLE `__new_source_heads` RENAME TO `source_heads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_runs` (
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
INSERT INTO `__new_sync_runs`(`id`, `base_run_id`, `datasource_ids`, `status`, `created_at`, `started_at`, `finished_at`, `error`) SELECT `id`, `base_run_id`, `datasource_ids`, `status`, `created_at`, `started_at`, `finished_at`, `error` FROM `sync_runs`;--> statement-breakpoint
DROP TABLE `sync_runs`;--> statement-breakpoint
ALTER TABLE `__new_sync_runs` RENAME TO `sync_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `page_ref_date_url` ON `page_ref` (`published_at`,`url`,`sync_run_id`);--> statement-breakpoint
CREATE INDEX `datasource_snapshots_datasource` ON `datasources` (`slug`);--> statement-breakpoint
CREATE INDEX `sync_runs_status_created` ON `sync_runs` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_sections_revision_order` ON `page_sections` (`revision_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `page_sections_revision` ON `page_sections` (`revision_id`);