CREATE TABLE `page_pin` (
	`user_id` text NOT NULL,
	`path` text NOT NULL,
	PRIMARY KEY(`user_id`, `path`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
