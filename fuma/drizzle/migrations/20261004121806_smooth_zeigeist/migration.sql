PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_datasources` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text,
	`mounted_path` text NOT NULL,
	`sort_order` integer NOT NULL,
	`tree` text,
	`sync_run_id` integer
);
--> statement-breakpoint
INSERT INTO `__new_datasources`(`id`, `slug`, `name`, `description`, `icon`, `mounted_path`, `sort_order`, `tree`, `sync_run_id`) SELECT `id`, `slug`, `name`, `description`, `icon`, `mounted_path`, `sort_order`, `tree`, `sync_run_id` FROM `datasources`;--> statement-breakpoint
DROP TABLE `datasources`;--> statement-breakpoint
ALTER TABLE `__new_datasources` RENAME TO `datasources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `datasource_slug_index` ON `datasources` (`slug`);