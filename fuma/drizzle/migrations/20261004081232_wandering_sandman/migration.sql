DROP INDEX IF EXISTS `datasource_snapshots_datasource`;--> statement-breakpoint
CREATE UNIQUE INDEX `datasource_slug_index` ON `datasources` (`slug`);