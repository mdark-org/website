CREATE TABLE `datasources` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text,
	`mounted_path` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`tree` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_contents` (
	`url` text PRIMARY KEY,
	`markdown` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`url` text PRIMARY KEY,
	`datasource_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`published_at` integer DEFAULT 0 NOT NULL,
	`tags` text,
	`bvid` text,
	`ytid` text,
	`wbid` text,
	`xgid` text,
	`rss` integer,
	`filename` text,
	`ext` text,
	`github` text
);
--> statement-breakpoint
CREATE INDEX `pages_ds_date` ON `pages` (`datasource_id`,`published_at`,`url`);--> statement-breakpoint
CREATE INDEX `pages_date` ON `pages` (`published_at`,`url`);