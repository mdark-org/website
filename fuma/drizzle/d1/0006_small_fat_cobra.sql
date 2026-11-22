DROP INDEX IF EXISTS `page_ref_date_url`;--> statement-breakpoint
CREATE UNIQUE INDEX `page_ref_run_url` ON `page_ref` (`sync_run_id`,`url`);