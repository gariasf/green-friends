CREATE TABLE `care_events` (
	`id` text PRIMARY KEY NOT NULL,
	`plant_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_on` text NOT NULL,
	`note` text,
	`pot_size_cm` real,
	`soil` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `plants` (
	`id` text PRIMARY KEY NOT NULL,
	`species_id` text,
	`nickname` text,
	`pot_size_cm` real,
	`soil` text,
	`watering_growing_days` integer,
	`watering_dormant_days` integer,
	`fertilizing_growing_days` integer,
	`fertilizing_dormant_days` integer,
	`repotting_months` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
