ALTER TABLE `species` ADD `rests_in_summer` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Overrides of plants whose Species rests in summer (ADR-0009) were set for the garden's Season;
-- turn both-set ones around. The Species are named here, since an Import migrates an Export's
-- rows with no catalog beside them (ADR-0002). The swap is stamped with the day it shipped, not
-- now: an old Export's rows, turned around on Import, then tie with this database's and lose to
-- any edit made since.
UPDATE `plants` SET `watering_growing_days` = `watering_dormant_days`, `watering_dormant_days` = `watering_growing_days`, `updated_at` = MAX(`updated_at`, '2026-09-27T00:00:00.000Z') WHERE `species_id` IN ('Q138279', 'Q511569', 'Q11679534', 'Q150055') AND `watering_growing_days` IS NOT NULL AND `watering_dormant_days` IS NOT NULL;
--> statement-breakpoint
UPDATE `plants` SET `fertilizing_growing_days` = `fertilizing_dormant_days`, `fertilizing_dormant_days` = `fertilizing_growing_days`, `updated_at` = MAX(`updated_at`, '2026-09-27T00:00:00.000Z') WHERE `species_id` IN ('Q138279', 'Q511569', 'Q11679534', 'Q150055') AND `fertilizing_growing_days` IS NOT NULL AND `fertilizing_dormant_days` IS NOT NULL;
