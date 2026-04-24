ALTER TABLE `products` ADD `imageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `products` ADD `status` enum('active','inactive') DEFAULT 'active' NOT NULL;