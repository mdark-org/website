PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`base_run_id` integer,
	`datasource_ids` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error` text
);
--> statement-breakpoint
INSERT INTO `__new_sync_runs`(`id`, `base_run_id`, `datasource_ids`, `status`, `created_at`, `started_at`, `finished_at`, `error`) SELECT `id`, `base_run_id`, `datasource_ids`, `status`, `created_at`, `started_at`, `finished_at`, `error` FROM `sync_runs`;--> statement-breakpoint
DROP TABLE `sync_runs`;--> statement-breakpoint
ALTER TABLE `__new_sync_runs` RENAME TO `sync_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_source_heads` (
	`id` text PRIMARY KEY,
	`sync_run_id` integer NOT NULL,
	`search_slot` text,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_source_heads`(`id`, `sync_run_id`, `search_slot`, `published_at`) SELECT `id`, `sync_run_id`, `search_slot`, `published_at` FROM `source_heads`;--> statement-breakpoint
DROP TABLE `source_heads`;--> statement-breakpoint
ALTER TABLE `__new_source_heads` RENAME TO `source_heads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sync_runs_status_created` ON `sync_runs` (`status`,`created_at`);