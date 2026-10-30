CREATE TABLE `page_tag` (
	`page_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`page_id`, `tag`),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_tag_tag_idx` ON `page_tag` (`tag`);