CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`growing_start_month` integer NOT NULL,
	`growing_end_month` integer NOT NULL,
	`digest_time` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
-- Default settings row (growing season March-October, digest 09:00). The epoch timestamps mean any
-- user-edited settings row arriving via Import wins the last-write-wins merge (ADR-0002).
INSERT INTO `settings` (`id`, `growing_start_month`, `growing_end_month`, `digest_time`, `created_at`, `updated_at`, `deleted_at`)
VALUES ('00000000-0000-0000-0000-000000000001', 3, 10, '09:00', '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z', NULL);
