CREATE TABLE `page_link` (
	`page_id` text NOT NULL,
	`target` text NOT NULL,
	PRIMARY KEY(`page_id`, `target`),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_link_target_idx` ON `page_link` (`target`);