CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`plant_id` text NOT NULL,
	`filename` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
