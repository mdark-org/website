CREATE TABLE `page_sections` (
	`page_revision_id` text NOT NULL,
	`section_id` text NOT NULL,
	`section_hash` text NOT NULL,
	`body_hash` text NOT NULL,
	`title` text,
	`heading_path` text NOT NULL,
	`anchor` text,
	`level` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`start_offset` integer NOT NULL,
	`end_offset` integer NOT NULL,
	CONSTRAINT `fk_page_sections_page_revision_id_page_versions_revision_id_fk` FOREIGN KEY (`page_revision_id`) REFERENCES `page_versions`(`revision_id`) ON DELETE CASCADE
);

--> statement-breakpoint
CREATE UNIQUE INDEX `page_sections_identity` ON `page_sections` (`page_revision_id`,`section_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_sections_order` ON `page_sections` (`page_revision_id`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `page_sections_page` ON `page_sections` (`page_revision_id`);
--> statement-breakpoint
CREATE INDEX `page_sections_section` ON `page_sections` (`section_id`);
