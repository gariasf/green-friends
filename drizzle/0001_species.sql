CREATE TABLE `species` (
	`id` text PRIMARY KEY NOT NULL,
	`colloquial_name` text NOT NULL,
	`scientific_name` text NOT NULL,
	`watering_growing_days` integer,
	`watering_dormant_days` integer,
	`fertilizing_growing_days` integer,
	`fertilizing_dormant_days` integer,
	`repotting_months` integer
);
--> statement-breakpoint
CREATE TABLE `species_dataset` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL
);
