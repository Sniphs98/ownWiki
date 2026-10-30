ALTER TABLE `page_link` ADD `target_page_id` text REFERENCES page(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `page_link_target_page_id_idx` ON `page_link` (`target_page_id`);